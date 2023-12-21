import {
  InkeepStream,
  OnFinalInkeepMetadata,
  StreamingTextResponse,
  experimental_StreamData,
  InkeepAIStreamCallbacksAndOptions,
} from 'ai';
import { InkeepApiClient, continueChat, createChatSession } from './inkeepApi';

interface ChatRequestBody {
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
  chat_session_id?: string;
}

const inkeepApiKey = process.env.INKEEP_API_KEY;
const inkeepIntegrationId = process.env.INKEEP_INTEGRATION_ID;

if (!inkeepApiKey || !inkeepIntegrationId) {
  throw new Error('Inkeep identifiers undefined');
}

export type InkeepChatResultCustomData = {
  chat_session_id?: string;
};

const client = new InkeepApiClient(inkeepApiKey);

// examples/next-inkeep/app/api/chat/route.ts
export async function POST(req: Request) {
  const chatRequestBody: ChatRequestBody = await req.json();
  const chatId = chatRequestBody.chat_session_id;

  let response;
  if (!chatId) {
    // new chat session
    response = await createChatSession({
      input: {
        integration_id: inkeepIntegrationId!,
        chat_session: {
          messages: chatRequestBody.messages,
        },
        stream: true,
      },
      client,
    });
  } else {
    // continue chat session
    response = await continueChat({
      input: {
        integration_id: inkeepIntegrationId!,
        chat_session_id: chatId,
        message: chatRequestBody.messages[chatRequestBody.messages.length - 1],
      },
      client,
    });
  }

  // data is used to pass custom metadata to the client, like chat_session_id
  const data = new experimental_StreamData();

  if (!response?.body) {
    throw new Error('Response body is null');
  }

  const stream = InkeepStream(response, {
    onRecordsCited: async recordsCited => {
      data.append({ onRecordsCited: JSON.parse(JSON.stringify(recordsCited)) });
    },
    onFinal: async (complete: string, metadata?: OnFinalInkeepMetadata) => {
      if (metadata) {
        data.append({ onFinalMetadata: metadata });
      }
      data.close();
    },
    experimental_streamData: true,
  });

  return new StreamingTextResponse(stream, {}, data);
}
