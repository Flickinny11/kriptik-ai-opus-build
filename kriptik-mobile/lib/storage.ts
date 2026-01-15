/**
 * Storage wrapper that uses SecureStore with AsyncStorage fallback
 * SecureStore requires proper code signing to work on iOS
 */

import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Track if SecureStore is available
let secureStoreAvailable: boolean | null = null;

async function checkSecureStoreAvailability(): Promise<boolean> {
  if (secureStoreAvailable !== null) {
    return secureStoreAvailable;
  }
  
  try {
    const testKey = '__kriptik_secure_test__';
    await SecureStore.setItemAsync(testKey, 'test');
    await SecureStore.deleteItemAsync(testKey);
    secureStoreAvailable = true;
    console.log('[Storage] SecureStore is available');
  } catch (error) {
    secureStoreAvailable = false;
    console.log('[Storage] SecureStore not available, using AsyncStorage fallback');
  }
  
  return secureStoreAvailable;
}

export async function getItemAsync(key: string): Promise<string | null> {
  const useSecure = await checkSecureStoreAvailability();
  
  try {
    if (useSecure) {
      return await SecureStore.getItemAsync(key);
    } else {
      return await AsyncStorage.getItem(key);
    }
  } catch (error) {
    // If SecureStore fails, try AsyncStorage as fallback
    try {
      return await AsyncStorage.getItem(key);
    } catch {
      console.error('[Storage] Failed to get item:', key, error);
      return null;
    }
  }
}

export async function setItemAsync(key: string, value: string): Promise<void> {
  const useSecure = await checkSecureStoreAvailability();
  
  try {
    if (useSecure) {
      await SecureStore.setItemAsync(key, value);
    } else {
      await AsyncStorage.setItem(key, value);
    }
  } catch (error) {
    // If SecureStore fails, try AsyncStorage as fallback
    try {
      await AsyncStorage.setItem(key, value);
    } catch {
      console.error('[Storage] Failed to set item:', key, error);
    }
  }
}

export async function deleteItemAsync(key: string): Promise<void> {
  const useSecure = await checkSecureStoreAvailability();
  
  try {
    if (useSecure) {
      await SecureStore.deleteItemAsync(key);
    } else {
      await AsyncStorage.removeItem(key);
    }
  } catch (error) {
    // If SecureStore fails, try AsyncStorage as fallback
    try {
      await AsyncStorage.removeItem(key);
    } catch {
      console.error('[Storage] Failed to delete item:', key, error);
    }
  }
}

// Export wrapper with same interface as SecureStore
export const storage = {
  getItemAsync,
  setItemAsync,
  deleteItemAsync,
};

export default storage;
