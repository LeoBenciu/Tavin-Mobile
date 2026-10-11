import { configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import { AppState, Platform } from 'react-native';

import { api } from './api';

export const store = configureStore({
  reducer: { [api.reducerPath]: api.reducer },
  middleware: (getDefault) => getDefault().concat(api.middleware),
});

/** refetchOnFocus / refetchOnReconnect, driven by the app's foreground state on phones. */
setupListeners(store.dispatch, (dispatch, { onFocus, onFocusLost, onOnline }) => {
  if (Platform.OS === 'web') return () => {};
  const sub = AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      dispatch(onFocus());
      dispatch(onOnline());
    } else {
      dispatch(onFocusLost());
    }
  });
  return () => sub.remove();
});

export type RootState = ReturnType<typeof store.getState>;
