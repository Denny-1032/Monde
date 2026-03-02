import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Dimensions, Platform, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, Spacing, BorderRadius } from '../constants/theme';
import { useColors } from '../constants/useColors';
import { parseQRData } from '../lib/helpers';
import Button from '../components/Button';

const { width } = Dimensions.get('window');
const SCAN_SIZE = width * 0.7;

function WebScanFallback({ onScan, onBack, onMyQR }: { onScan: (e: { data: string }) => void; onBack: () => void; onMyQR: () => void }) {
  const colors = useColors();
  const [qrText, setQrText] = useState('');
  return (
    <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
      <Ionicons name="qr-code-outline" size={64} color={colors.primary} />
      <Text style={[styles.permTitle, { color: colors.text }]}>Scan QR Code</Text>
      <Text style={[styles.permText, { color: colors.textSecondary }]}>Camera scanning is not available on web. Paste QR code data below or use a mobile device.</Text>
      <TextInput
        style={[styles.webInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
        value={qrText}
        onChangeText={setQrText}
        placeholder='Paste QR code data here'
        placeholderTextColor={colors.textLight}
        multiline
      />
      <Button title="Process QR Data" onPress={() => { if (qrText.trim()) onScan({ data: qrText.trim() }); }} disabled={!qrText.trim()} size="lg" style={{ marginTop: Spacing.sm, width: '100%' }} />
      <Button title="My QR Code" onPress={onMyQR} variant="outline" size="md" style={{ marginTop: Spacing.sm, width: '100%' }} />
      <Button title="Go Back" onPress={onBack} variant="ghost" style={{ marginTop: Spacing.sm }} />
    </View>
  );
}

export default function ScanScreen() {
  const colors = useColors();
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);

    const payload = parseQRData(data);
    if (payload) {
      router.push({
        pathname: '/payment',
        params: {
          recipientName: payload.name,
          recipientPhone: payload.phone,
          provider: payload.provider,
          amount: payload.amount?.toString() || '',
          method: 'qr',
        },
      });
    } else {
      Alert.alert('Invalid QR Code', 'This QR code is not a valid Monde payment code.', [
        { text: 'Scan Again', onPress: () => setScanned(false) },
        { text: 'Cancel', onPress: () => router.back() },
      ]);
    }
  };

  if (!permission) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <Text style={[styles.permText, { color: colors.textSecondary }]}>Requesting camera permission...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <Ionicons name="camera-outline" size={64} color={colors.textLight} />
        <Text style={[styles.permTitle, { color: colors.text }]}>Camera Access Needed</Text>
        <Text style={[styles.permText, { color: colors.textSecondary }]}>Monde needs camera access to scan QR codes for payments</Text>
        <Button title="Allow Camera" onPress={requestPermission} size="lg" style={{ marginTop: Spacing.lg }} />
        <Button title="Go Back" onPress={() => router.back()} variant="ghost" style={{ marginTop: Spacing.sm }} />
      </View>
    );
  }

  if (Platform.OS === 'web') {
    return (
      <WebScanFallback
        onScan={handleBarCodeScanned}
        onBack={() => router.back()}
        onMyQR={() => router.push('/receive')}
      />
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
      />

      {/* Overlay */}
      <View style={styles.overlay}>
        {/* Top bar */}
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
            <Ionicons name="close" size={28} color={Colors.white} />
          </TouchableOpacity>
          <Text style={styles.title}>Scan QR Code</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Scanner frame */}
        <View style={styles.scanArea}>
          <View style={styles.scanFrame}>
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
          </View>
        </View>

        {/* Bottom info */}
        <View style={styles.bottomArea}>
          <Text style={styles.hint}>Point your camera at a Monde QR code</Text>
          <View style={styles.bottomActions}>
            <TouchableOpacity style={styles.bottomBtn} onPress={() => router.push('/receive')}>
              <View style={styles.bottomBtnIcon}>
                <Ionicons name="qr-code" size={22} color={Colors.white} />
              </View>
              <Text style={styles.bottomBtnLabel}>My QR Code</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.black,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
  },
  permTitle: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    textAlign: 'center',
  },
  permText: {
    fontSize: FontSize.md,
    textAlign: 'center',
  },
  webInput: {
    width: '100%',
    minHeight: 80,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: FontSize.sm,
    textAlignVertical: 'top',
    marginTop: Spacing.md,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.white,
  },
  scanArea: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanFrame: {
    width: SCAN_SIZE,
    height: SCAN_SIZE,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: Colors.white,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 8,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 8,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 8,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 8,
  },
  bottomArea: {
    alignItems: 'center',
    paddingBottom: 60,
    gap: Spacing.lg,
  },
  hint: {
    fontSize: FontSize.md,
    color: Colors.white,
    opacity: 0.8,
  },
  bottomActions: {
    flexDirection: 'row',
    gap: Spacing.lg,
  },
  bottomBtn: {
    alignItems: 'center',
    gap: Spacing.sm,
  },
  bottomBtnIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomBtnLabel: {
    fontSize: FontSize.xs,
    color: Colors.white,
    fontWeight: '600',
  },
});
