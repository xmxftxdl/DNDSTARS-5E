import Constants from 'expo-constants'
import { requireOptionalNativeModule } from 'expo-modules-core'
import { Platform } from 'react-native'

export type MobilePushPermissionState = 'unknown' | 'unsupported' | 'denied' | 'enabled'

type NotificationsModule = typeof import('expo-notifications')
const optionalDeviceModule = requireOptionalNativeModule<{ isDevice?: boolean }>('ExpoDevice')
const optionalPushTokenManager = requireOptionalNativeModule('ExpoPushTokenManager')
let notificationsPromise: Promise<NotificationsModule | null> | null = null

function optionalNotifications() {
  // Importing expo-notifications evaluates every native adapter exported by the
  // package. Older development builds do not contain those adapters, so even a
  // caught dynamic import can surface a fatal React Native module error first.
  // ExpoPushTokenManager is part of every supported native installation and is
  // therefore used as the capability sentinel before evaluating the package.
  if (!optionalPushTokenManager) return Promise.resolve(null)
  notificationsPromise ??= import('expo-notifications').catch(() => null)
  return notificationsPromise
}

export async function mobilePushPermissionState(): Promise<MobilePushPermissionState> {
  const Notifications = await optionalNotifications()
  if (!optionalDeviceModule?.isDevice || !Notifications || (Platform.OS !== 'ios' && Platform.OS !== 'android')) return 'unsupported'
  const permission = await Notifications.getPermissionsAsync()
  if (permission.granted) return 'enabled'
  if (!permission.canAskAgain) return 'denied'
  return 'unknown'
}

export async function requestMobilePushToken(): Promise<{
  token: string
  platform: 'ios' | 'android'
}> {
  const Notifications = await optionalNotifications()
  if (!optionalDeviceModule?.isDevice || !Notifications || (Platform.OS !== 'ios' && Platform.OS !== 'android')) {
    throw new Error('push-real-device-required')
  }
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('room-events', {
      name: '房间事件',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 180, 120, 180],
      lightColor: '#8b5cf6',
    })
  }
  let permission = await Notifications.getPermissionsAsync()
  if (!permission.granted && permission.canAskAgain) {
    permission = await Notifications.requestPermissionsAsync()
  }
  if (!permission.granted) throw new Error('push-permission-denied')
  const projectId = Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId
  if (typeof projectId !== 'string' || !projectId) throw new Error('push-project-id-missing')
  const token = await Notifications.getExpoPushTokenAsync({ projectId })
  return { token: token.data, platform: Platform.OS }
}

export async function installForegroundNotificationHandler() {
  const Notifications = await optionalNotifications()
  if (!Notifications) return
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  })
}
