import { doc, getDoc, setDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { logManagerAction } from './managerService';
import { col } from '../config/environment';


export interface AppConfig {
    epaycoGlobalTestMode: boolean;
    systemMaintenance: boolean;
    epaycoPublicKey: string;
    epaycoPcustid: string;
    updatedAt: Timestamp;
    updatedBy: string;
}

const CONFIG_DOC_ID = 'global_settings';

/**
 * Get the global application configuration
 */
export const getAppConfig = async (): Promise<AppConfig | null> => {
    try {
        const docRef = doc(db, col('app_config'), CONFIG_DOC_ID);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            return docSnap.data() as AppConfig;
        } else {
            // Initialize with defaults if it doesn't exist
            const defaultConfig: AppConfig = {
                epaycoGlobalTestMode: true,
                systemMaintenance: false,
                epaycoPublicKey: '',
                epaycoPcustid: '',
                updatedAt: Timestamp.now(),
                updatedBy: 'system'
            };
            await setDoc(docRef, defaultConfig);
            return defaultConfig;
        }
    } catch (error) {
        console.error("Error fetching app config:", error);
        return null;
    }
};

/**
 * Update global application configuration
 */
export const updateAppConfig = async (updates: Partial<AppConfig>, managerId: string) => {
    try {
        const docRef = doc(db, col('app_config'), CONFIG_DOC_ID);
        const finalUpdates = {
            ...updates,
            updatedAt: Timestamp.now(),
            updatedBy: managerId
        };
        
        await updateDoc(docRef, finalUpdates);
        
        await logManagerAction(
            'update_app_config',
            `Global settings updated: ${JSON.stringify(updates)}`,
            { updates, managerId }
        );
    } catch (error) {
        console.error("Error updating app config:", error);
        throw error;
    }
};
