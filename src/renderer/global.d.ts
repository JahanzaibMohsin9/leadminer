import { IpcApi } from '../common/types';

declare global {
  interface Window {
    electron: IpcApi;
  }
}
