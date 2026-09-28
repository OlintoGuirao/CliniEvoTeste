import { Capacitor, registerPlugin } from '@capacitor/core';

export interface ShareToStoryOptions {
  filePath: string;
  fileProviderAuthority: string;
  attributionLinkUrl?: string;
}

export interface ShareToStoryResult {
  installed: boolean;
  opened?: boolean;
}

export interface InstagramStoryPlugin {
  shareToStory(options: ShareToStoryOptions): Promise<ShareToStoryResult>;
}

export const InstagramStory = registerPlugin<InstagramStoryPlugin>('InstagramStoryPlugin', {
  web: async () => ({
    async shareToStory(): Promise<ShareToStoryResult> {
      console.warn('[InstagramStoryPlugin] shareToStory só funciona em dispositivos nativos.');
      return { installed: false, opened: false };
    },
  }),
});

export function getFileProviderAuthority() {
  // applicationId do Android é o id do app no Capacitor
  const appId = (Capacitor as any).getAppInfo?.()?.id ?? 'com.olintoguirrao.clinievo';
  return `${appId}.fileprovider`;
}

