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

import { MessageHandler } from "../../message";

enum MessageEventType { UNKNOWN, ECHO, TEXT, ATTACHMENTS, POSTBACK };

export interface FacebookMessageHandlerOptions<T> {
    echoHandler: MessageHandler<T>;
    textHandler: MessageHandler<T>;
    attachmentsHandler: MessageHandler<T>;
    postbackHandler: MessageHandler<T>;
    unknownHandler: MessageHandler<T>;
}

export interface FacebookMessageAttachment {
    type: string;
    payload: { url?: string; sticker_id?: number };
}

export const CreateFacebookMessageHandler =
    <T>(options: FacebookMessageHandlerOptions<T>) =>
        (message: any): Promise<T> => {
            switch (detectMessageEventType(message)) {
                case MessageEventType.ECHO:
                    return options.echoHandler(message);
                case MessageEventType.TEXT:
                    return options.textHandler(message);
                case MessageEventType.ATTACHMENTS:
                    return options.attachmentsHandler(message);
                case MessageEventType.POSTBACK:
                    return options.postbackHandler(message);
                default:
                    return options.unknownHandler(message);
            }
        };

const detectMessageEventType = (messageEvent: any): MessageEventType => {
    if (messageEvent.message) {
        let message = messageEvent.message;

        if (message.is_echo) {
            return MessageEventType.ECHO;
        } else if (message.text) {
            return MessageEventType.TEXT;
        } else if (message.attachments) {
            return MessageEventType.ATTACHMENTS;
        }
    } else if (messageEvent.postback) {
        return MessageEventType.POSTBACK;
    }
    return MessageEventType.UNKNOWN;
}
