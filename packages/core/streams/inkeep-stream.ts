// packages/core/streams/inkeep-stream.ts
import {
  AIStream,
  type AIStreamCallbacksAndOptions,
  AIStreamParser,
} from './ai-stream';
import { createStreamDataTransformer } from './stream-data';

export type InkeepMessage = {
  role: 'user' | 'assistant';
  content: string;
  [key: string]: any;
};

export type InkeepMessageChunkData = {
  chat_session_id: string;
  content_chunk: string;
  finish_reason?: string | null;
};

export type OnFinalInkeepMetadata = {
  chat_session_id: string;
  records_cited: InkeepRecordsCitedData;
};

export type Record = {
  type: string;
  url?: string | null;
  title?: string | null;
  breadcrumbs?: string[] | null;
};

export type Citation = {
  number: number;
  record: Record;
};

export type InkeepRecordsCitedData = {
  citations: Citation[];
};

export type InkeepChatResultCallbacks = {
  onFinal?: (
    completion: string,
    metadata?: OnFinalInkeepMetadata,
  ) => Promise<void> | void;
  onRecordsCited?: (recordsCited: InkeepRecordsCitedData) => void;
};

export type InkeepAIStreamCallbacksAndOptions = AIStreamCallbacksAndOptions &
  InkeepChatResultCallbacks;

export function InkeepStream(
  res: Response,
  callbacks?: InkeepAIStreamCallbacksAndOptions,
): ReadableStream {
  if (!res.body) {
    throw new Error('Response body is null');
  }

  let chat_session_id = '';
  let records_cited: InkeepRecordsCitedData;

  const inkeepEventParser: AIStreamParser = (data: string, event) => {
    let inkeepContentChunk: InkeepMessageChunkData;

    if (event === 'records_cited') {
      const recordsCited = JSON.parse(data) as InkeepRecordsCitedData;
      records_cited = JSON.parse(data) as InkeepRecordsCitedData;
      callbacks?.onRecordsCited?.(recordsCited);
    }

    if (event === 'message_chunk') {
      inkeepContentChunk = JSON.parse(data) as InkeepMessageChunkData;
      chat_session_id = inkeepContentChunk.chat_session_id;
      return inkeepContentChunk.content_chunk;
    }
    return;
  };

  let { onRecordsCited, ...passThroughCallbacks } = callbacks || {};

  // extend onFinal callback with Inkeep specific metadata
  passThroughCallbacks = {
    ...passThroughCallbacks,
    onFinal: completion => {
      const onFinalInkeepMetadata: OnFinalInkeepMetadata = {
        chat_session_id,
        records_cited,
      };
      callbacks?.onFinal?.(completion, onFinalInkeepMetadata);
    },
  };

  return AIStream(res, inkeepEventParser, passThroughCallbacks).pipeThrough(
    createStreamDataTransformer(passThroughCallbacks?.experimental_streamData),
  );
}
