import {APIGatewayProxyHandler} from 'aws-lambda';
import Slack from '@slack/bolt'
import {ChatGPTAPI, ChatGPTUnofficialProxyAPI} from "chatgpt";
import debounce from 'debounce-promise';
// import {Chat} from './chat'

const api = new ChatGPTAPI({
    apiKey: process.env.OPENAI_API_KEY!,
    maxResponseTokens: process.env.MAX_RESPONSE_TOKEN ? Number(process.env.MAX_RESPONSE_TOKEN) : 1000,
    completionParams : {
        temperature : process.env.TEMPERATURE ? Number(process.env.TEMPERATURE) : 0.9

    },
    debug: true
})

// const api = Chat.getChat();


// const api = new ChatGPTUnofficialProxyAPI({
//     accessToken: process.env.OPENAI_ACCESS_TOKEN!,
//     debug: true
// })

const awsLambdaReceiver = new Slack.AwsLambdaReceiver({
    signingSecret: process.env.SLACK_SIGNING_SECRET!,
});

const app = new Slack.App({
    token: process.env.SLACK_BOT_TOKEN,
    receiver: awsLambdaReceiver,
    processBeforeResponse: true
});

const updateMessage = debounce(async ({channel, ts, text, payload}: any) => {
    await app.client.chat.update({
        channel: channel,
        ts: ts,
        text: text,
        metadata: payload ? {
            event_type: "chat_gpt",
            event_payload: payload
        } : undefined
    });
}, 400);

app.event("app_mention", async ({event, say}) => {
    console.log('app_mention channel', event);

    const question = event.text.replace(/(?:\s)<@[^, ]*|(?:^)<@[^, ]*/, '');

    const ms = await say({
        channel: event.channel,
        text: ':thought_balloon:',
    });

    const answer = await api.sendMessage(question, {
        // Real-time update
        onProgress: async (answer) => {
            await updateMessage({
                channel: ms.channel!,
                ts: ms.ts!,
                text: answer.text,
            });
        }
    });

    await updateMessage({
        channel: ms.channel!,
        ts: ms.ts!,
        text: `${answer.text}`,
    });
});

app.message("reset", async ({message, say}) => {
    console.log('reset channel', message.channel);

    await say({
        channel: message.channel,
        text: 'I reset your session',
    });
});

app.message(async ({message, say}) => {
    console.log('user message', message);
    const isUserMessage = message.type === "message" && !message.subtype && !message.bot_id;
    if (isUserMessage && message.text && message.text !== "reset") {
        const {messages} = await app.client.conversations.history({
            channel: message.channel,
            latest: message.ts,
            inclusive: true,
            include_all_metadata: true,
            limit: 2
        });

        const previous = (messages || [])[1]?.metadata?.event_payload as any || {
            parentMessageId: undefined,
            conversationId: undefined
        };

        const ms = await say({
            channel: message.channel,
            text: ':thought_balloon:',
        });


        let answerText = "";
        try {
            const answer = await api.sendMessage(message.text, {
                parentMessageId: previous.parentMessageId,
                conversationId: previous.conversationId,
                onProgress: async (answer) => {
                    // Real-time update
                    answerText = answer.text;
                    await updateMessage({
                        channel: ms.channel,
                        ts: ms.ts,
                        text: answerText,
                        payload: answer,
                    });
                }
            });


            await updateMessage({
                channel: ms.channel,
                ts: ms.ts,
                text: `${answerText} :end:`,
                payload: answer,
            });
        } catch (error) {
            console.error(error);

            if (error instanceof Error) {
                await updateMessage({
                    channel: ms.channel!,
                    ts: ms.ts!,
                    text: `${answerText}- ${error.toString()}`,
                });
            } else {
                await updateMessage({
                    channel: ms.channel!,
                    ts: ms.ts!,
                    text: `${answerText}- 未知错误`
                });
            }
        }
    }
});

app.error((error) => {
    console.error(error);

    return Promise.resolve();
});

export const handler: APIGatewayProxyHandler = async (event, context, callback) => {
    if (event.headers['X-Slack-Retry-Num']) {
        return {statusCode: 200, body: "ok"}
    }
    const handler = await awsLambdaReceiver.start();

    return handler(event, context, callback);
}