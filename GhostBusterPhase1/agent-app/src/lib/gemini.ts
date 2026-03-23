import { google } from '@ai-sdk/google';

export const multimodalReasoningModel = () => google('gemini-2.5-flash');
export const codeModel = () => google('gemini-2.5-pro-exp');
