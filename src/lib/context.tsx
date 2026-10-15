import { createContext, useContext, type ReactNode } from 'react';
import { type Data } from './model';
export type Run = <T>(action: () => Promise<T>, success?: string) => Promise<T | undefined>;
export type Toast = (message: string, undo?: () => Promise<unknown>) => void;
export const AppContext = createContext<{ data: Data; run: Run; toast: Toast; pending?: boolean }>(
  {} as never,
);
export const useApp = () => useContext(AppContext);
export const go = (route: string) => {
  location.hash = '/' + route;
  window.scrollTo(0, 0);
};
