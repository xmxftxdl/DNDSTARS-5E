import Constants from 'expo-constants'
import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'

export type MobilePushPermissionState = 'unknown' | 'unsupported' | 'denied' | 'enabled'

export async function mobilePushPermissionState(): Promise<MobilePushPermissionState> {
  if (!Device.isDevice || (Platform.OS !== 'ios' && Platform.OS !== 'android')) return 'unsupported'
  const permission = await Notifications.getPermissionsAsync()
  if (permission.granted) return 'enabled'
  if (!permission.canAskAgain) return 'denied'
  return 'unknown'
}

export async function requestMobilePushToken(): Promise<{
  token: string
  platform: 'ios' | 'android'
}> {
  if (!Device.isDevice || (Platform.OS !== 'ios' && Platform.OS !== 'android')) {
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

export function installForegroundNotificationHandler() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  })
}
