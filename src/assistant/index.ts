/*
 * Copyright 2017 kkpoon
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as Rx from "@reactivex/rxjs";
import { Say, Sorry, Ignore, LabelImage, Wit } from "./skills";
import { MessageHandler } from "../message";
import {
    SendTextMessage,
    SendTextMessageWithQuickReplies,
    SendAudioMessage,
    SendMarkSeen,
    SendTypingOff,
    SendTypingOn
} from "../platforms/facebook/send-api";
import {
    FacebookMessageAttachment,
    CreateFacebookMessageHandler
} from "../platforms/facebook/message";

export const CreateAssistant =
    (PAGE_ACCESS_TOKEN: string, GOOGLE_APIKEY: string, WIT_ACCESS_TOKEN: string, SESSION_BUCKET: string): MessageHandler<string> =>
        CreateFacebookMessageHandler<string>({
            echoHandler: message => Ignore(),
            textHandler: humanActionProxy(PAGE_ACCESS_TOKEN)(handleTextMessage(PAGE_ACCESS_TOKEN, GOOGLE_APIKEY, WIT_ACCESS_TOKEN, SESSION_BUCKET)),
            attachmentsHandler: humanActionProxy(PAGE_ACCESS_TOKEN)(handleAttachmentsMessage(PAGE_ACCESS_TOKEN)),
            postbackHandler: message => Ignore(),
            unknownHandler: handleUnknownMessage(PAGE_ACCESS_TOKEN)
        });

const humanActionProxy =
    (PAGE_ACCESS_TOKEN: string) =>
        (actualHandler: MessageHandler<string>) => (message: any) => {
            let userID = message.sender.id;

            return SendMarkSeen(PAGE_ACCESS_TOKEN)(userID)
                .then(() => SendTypingOn(PAGE_ACCESS_TOKEN)(userID))
                .then(() => actualHandler(message))
                .catch(err => {
                    console.error("[assistant] message handle error: " + err);
                    return SendTextMessage(PAGE_ACCESS_TOKEN)(userID)(
                        "Sorry, I've got brain problems."
                    ).then(() => "[assistant] response to tell error");
                })
                .then(result => SendTypingOff(PAGE_ACCESS_TOKEN)(userID).then(() => result));
        };

const handleUnknownMessage =
    (PAGE_ACCESS_TOKEN: string) =>
        (message: any) => {
            let userID = message.sender.id;
            return Sorry(SendTextMessage(PAGE_ACCESS_TOKEN)(userID));
        };

const handleTextMessage =
    (PAGE_ACCESS_TOKEN: string, GOOGLE_APIKEY: string, WIT_ACCESS_TOKEN: string, SESSION_BUCKET: string) =>
        (messageEvent: any) => {
            let userID = messageEvent.sender.id;
            let message = messageEvent.message;
            let messageText = message.text;

            if (messageText.match(/^say (.+)$/i)) {
                return Say(
                    SendTextMessage(PAGE_ACCESS_TOKEN)(userID),
                    SendAudioMessage(PAGE_ACCESS_TOKEN)(userID),
                    GOOGLE_APIKEY,
                    messageText
                );
            }

            return Wit(WIT_ACCESS_TOKEN, SESSION_BUCKET)(
                SendTextMessage(PAGE_ACCESS_TOKEN)(userID),
                SendTextMessageWithQuickReplies(PAGE_ACCESS_TOKEN)(userID),
                userID,
                messageText
            ).then(() => "[assistant] response by wit.ai");
        };

const handleAttachmentsMessage =
    (PAGE_ACCESS_TOKEN: string) =>
        (messageEvent: any) => {
            let message = messageEvent.message;
            let userID = messageEvent.sender.id;
            let attachments = message.attachments;

            return Rx.Observable
                .from(attachments)
                .mergeMap((att: FacebookMessageAttachment) => {
                    switch (att.type) {
                        case "image":
                            return Rx.Observable.fromPromise(handleImageMessage(PAGE_ACCESS_TOKEN)(userID, att));
                        default:
                            return Rx.Observable.fromPromise(Sorry(SendTextMessage(PAGE_ACCESS_TOKEN)(userID)));
                    }
                })
                .toArray()
                .map(results => results.join(", "))
                .toPromise();
        };

const handleImageMessage =
    (PAGE_ACCESS_TOKEN: string) =>
        (userID: string, att: FacebookMessageAttachment) => {
            if (att.payload && att.payload.sticker_id) {
                return Ignore();
            } else if (att.payload && att.payload.url) {
                return LabelImage(SendTextMessage(PAGE_ACCESS_TOKEN)(userID), att.payload.url);
            } else {
                return SendTextMessage(PAGE_ACCESS_TOKEN)(userID)("Sorry, I can't get the image")
                    .then(() => "[assistant] response with error on getting image");
            }
        };
