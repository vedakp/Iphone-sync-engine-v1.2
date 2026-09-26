import { DeviceInfo } from '../types';
import { syncDb } from './db';

const APPLE_VENDOR_ID = 0x05ac; // Apple USB Vendor ID

interface WebUSBDevice {
  vendorId: number;
  productId: number;
  productName?: string;
  serialNumber?: string;
}

interface WebUSBConnectionEvent extends Event {
  device: WebUSBDevice;
}

interface NavigatorWithUSB {
  usb?: {
    getDevices: () => Promise<WebUSBDevice[]>;
    requestDevice: (options: { filters: { vendorId: number }[] }) => Promise<WebUSBDevice>;
    addEventListener: (type: string, listener: (event: WebUSBConnectionEvent) => void) => void;
  };
}

export class DeviceDetector {
  private listeners: ((device: DeviceInfo | null) => void)[] = [];
  private currentDevice: DeviceInfo | null = null;
  private isListening = false;

  async init(): Promise<DeviceInfo | null> {
    const nav = navigator as unknown as NavigatorWithUSB;
    if (nav.usb) {
      try {
        const devices = await nav.usb.getDevices();
        const appleDevice = devices.find((d: WebUSBDevice) => d.vendorId === APPLE_VENDOR_ID);
        if (appleDevice) {
          this.currentDevice = this.createDeviceInfoFromUsb(appleDevice);
          await syncDb.saveDevice(this.currentDevice);
        }
      } catch (err) {
        console.warn('USB detection init error:', err);
      }

      if (!this.isListening && nav.usb.addEventListener) {
        this.isListening = true;
        nav.usb.addEventListener('connect', async (event: WebUSBConnectionEvent) => {
          if (event.device && event.device.vendorId === APPLE_VENDOR_ID) {
            this.currentDevice = this.createDeviceInfoFromUsb(event.device);
            await syncDb.saveDevice(this.currentDevice);
            this.notify(this.currentDevice);
          }
        });

        nav.usb.addEventListener('disconnect', (event: WebUSBConnectionEvent) => {
          if (event.device && event.device.vendorId === APPLE_VENDOR_ID) {
            if (this.currentDevice) {
              this.currentDevice.connected = false;
              syncDb.saveDevice(this.currentDevice);
            }
            this.currentDevice = null;
            this.notify(null);
          }
        });
      }
    }

    // Check last seen device from DB if none currently active
    if (!this.currentDevice) {
      const allDevices = await syncDb.getAllDevices();
      if (allDevices.length > 0) {
        // Return the most recently seen device
        allDevices.sort((a, b) => new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime());
        this.currentDevice = {
          ...allDevices[0],
          connected: false,
        };
      }
    }

    return this.currentDevice;
  }

  async requestUsbPermission(): Promise<DeviceInfo | null> {
    const nav = navigator as unknown as NavigatorWithUSB;
    if (!nav.usb) {
      throw new Error('WebUSB is not supported in this browser. Please use the Directory / Folder access mode.');
    }

    try {
      const device = await nav.usb.requestDevice({
        filters: [{ vendorId: APPLE_VENDOR_ID }],
      });
      this.currentDevice = this.createDeviceInfoFromUsb(device);
      await syncDb.saveDevice(this.currentDevice);
      this.notify(this.currentDevice);
      return this.currentDevice;
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'NotFoundError') {
        console.error('USB request error:', err);
      }
      return null;
    }
  }

  registerFolderDevice(folderName: string, path?: string): DeviceInfo {
    const id = `iphone_${folderName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    const device: DeviceInfo = {
      id,
      name: folderName.includes('APPLE') || folderName.toLowerCase().includes('dcim') ? 'Apple iPhone' : folderName,
      model: 'iPhone Internal Storage',
      firstSeenAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
      connected: true,
      sourcePath: path || folderName,
    };
    this.currentDevice = device;
    syncDb.saveDevice(device);
    this.notify(device);
    return device;
  }

  setDeviceDisconnected(): void {
    if (this.currentDevice) {
      this.currentDevice.connected = false;
      syncDb.saveDevice(this.currentDevice);
    }
    this.currentDevice = null;
    this.notify(null);
  }

  private createDeviceInfoFromUsb(device: WebUSBDevice): DeviceInfo {
    const productName = device.productName || 'Apple iPhone';
    const serial = device.serialNumber || `usb_${device.vendorId}_${device.productId}`;
    return {
      id: `dev_${serial}`,
      name: productName,
      model: productName,
      serialIdentifier: serial,
      firstSeenAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
      connected: true,
    };
  }

  subscribe(listener: (device: DeviceInfo | null) => void): () => void {
    this.listeners.push(listener);
    listener(this.currentDevice);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify(device: DeviceInfo | null) {
    for (const listener of this.listeners) {
      listener(device);
    }
  }
}

export const deviceDetector = new DeviceDetector();
