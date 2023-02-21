import {ChatGPTAPI, ChatGPTUnofficialProxyAPI, ChatMessage, SendMessageOptions} from "chatgpt";


export class Chat {
    private constructor() {
    }

    private static instance: Chat;


    public static getChat() {
        let apiType = process.env.API_TYPE
        if ("API" === apiType) {
            this.instance = new ChatGPTAPI({
                apiKey: process.env.OPENAI_API_KEY!,
                maxResponseTokens: process.env.MAX_RESPONSE_TOKEN ? Number(process.env.MAX_RESPONSE_TOKEN) : 1000,
                completionParams: {
                    temperature: process.env.TEMPERATURE ? Number(process.env.TEMPERATURE) : 0.9

                },
                debug: true
            })


        } else {
            this.instance = new ChatGPTUnofficialProxyAPI({
                accessToken: process.env.OPENAI_ACCESS_TOKEN!,
                debug: true
            })
        }

        return this.instance;
    }
}