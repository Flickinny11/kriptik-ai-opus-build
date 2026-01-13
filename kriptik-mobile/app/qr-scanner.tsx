import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { router, Stack } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { colors, typography, spacing, borderRadius } from '../lib/design-system';
import { Button } from '../components/ui';
import { CloseIcon, QRCodeIcon, CheckIcon } from '../components/icons';
import { api } from '../lib/api';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCAN_AREA_SIZE = SCREEN_WIDTH * 0.7;

export default function QRScannerScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [pairingStatus, setPairingStatus] = useState<'idle' | 'pairing' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  };

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (scanned || scanning) return;

    setScanned(true);
    setScanning(true);
    setPairingStatus('pairing');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    try {
      // Parse QR code - expected format: kriptik://pair?code=XXXX or just the code
      let pairCode = data;
      if (data.includes('code=')) {
        const match = data.match(/code=([A-Za-z0-9]+)/);
        if (match) {
          pairCode = match[1];
        }
      }

      // Call pairing API
      const response = await api.registerPushToken(pairCode);

      if (response.success) {
        setPairingStatus('success');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setTimeout(() => {
          router.back();
        }, 1500);
      } else {
        setPairingStatus('error');
        setErrorMessage(response.error || 'Pairing failed');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setScanning(false);
      }
    } catch (error) {
      setPairingStatus('error');
      setErrorMessage('Failed to pair device');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setScanning(false);
    }
  };

  const handleRetry = () => {
    setScanned(false);
    setPairingStatus('idle');
    setErrorMessage('');
  };

  if (!permission) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.permissionText}>Requesting camera permission...</Text>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.permissionContainer}>
          <QRCodeIcon size={64} color={colors.text.tertiary} />
          <Text style={styles.permissionTitle}>Camera Access Required</Text>
          <Text style={styles.permissionText}>
            We need camera access to scan QR codes for device pairing.
          </Text>
          <Button
            title="Grant Permission"
            onPress={requestPermission}
            size="lg"
          />
          <Button
            title="Cancel"
            variant="ghost"
            onPress={handleClose}
            style={styles.cancelButton}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false, presentation: 'fullScreenModal' }} />
      <View style={styles.container}>
        <CameraView
          style={StyleSheet.absoluteFill}
          barcodeScannerSettings={{
            barcodeTypes: ['qr'],
          }}
          onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        />

        {/* Overlay */}
        <View style={styles.overlay}>
          {/* Header */}
          <SafeAreaView edges={['top']}>
            <View style={styles.header}>
              <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
                <CloseIcon size={24} color={colors.text.primary} />
              </TouchableOpacity>
              <Text style={styles.title}>Scan QR Code</Text>
              <View style={styles.placeholder} />
            </View>
          </SafeAreaView>

          {/* Scan Area */}
          <View style={styles.scanAreaContainer}>
            <View style={styles.scanArea}>
              {/* Corner indicators */}
              <View style={[styles.corner, styles.cornerTopLeft]} />
              <View style={[styles.corner, styles.cornerTopRight]} />
              <View style={[styles.corner, styles.cornerBottomLeft]} />
              <View style={[styles.corner, styles.cornerBottomRight]} />

              {/* Status overlay */}
              {pairingStatus === 'pairing' && (
                <Animated.View entering={FadeIn} style={styles.statusOverlay}>
                  <Text style={styles.statusText}>Pairing...</Text>
                </Animated.View>
              )}

              {pairingStatus === 'success' && (
                <Animated.View entering={FadeIn} style={styles.successOverlay}>
                  <CheckIcon size={48} color={colors.status.success} />
                  <Text style={styles.successText}>Paired!</Text>
                </Animated.View>
              )}
            </View>
          </View>

          {/* Instructions */}
          <SafeAreaView edges={['bottom']} style={styles.footer}>
            {pairingStatus === 'error' ? (
              <Animated.View entering={FadeInUp} style={styles.errorContainer}>
                <Text style={styles.errorText}>{errorMessage}</Text>
                <Button title="Try Again" onPress={handleRetry} size="lg" />
              </Animated.View>
            ) : (
              <Text style={styles.instructions}>
                Point your camera at the QR code in KripTik web app settings
              </Text>
            )}
          </SafeAreaView>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.heading,
    color: colors.text.primary,
  },
  placeholder: {
    width: 40,
  },
  scanAreaContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanArea: {
    width: SCAN_AREA_SIZE,
    height: SCAN_AREA_SIZE,
    backgroundColor: 'transparent',
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderColor: colors.accent.primary,
  },
  cornerTopLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 8,
  },
  cornerTopRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 8,
  },
  cornerBottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 8,
  },
  cornerBottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 8,
  },
  statusOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  statusText: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.heading,
    color: colors.text.primary,
  },
  successOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  successText: {
    fontSize: typography.fontSize.xl,
    fontFamily: typography.fontFamily.heading,
    color: colors.status.success,
    marginTop: spacing.md,
  },
  footer: {
    padding: spacing.xl,
  },
  instructions: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.body,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  errorContainer: {
    alignItems: 'center',
    gap: spacing.lg,
  },
  errorText: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.body,
    color: colors.status.error,
    textAlign: 'center',
  },
  permissionContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.lg,
  },
  permissionTitle: {
    fontSize: typography.fontSize.xl,
    fontFamily: typography.fontFamily.heading,
    color: colors.text.primary,
    marginTop: spacing.lg,
  },
  permissionText: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.body,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  cancelButton: {
    marginTop: spacing.sm,
  },
});
