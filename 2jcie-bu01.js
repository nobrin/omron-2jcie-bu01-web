function UUID(shortUUID) {
    const BaseUUID = "ab70XXXX-0a3a-11e8-ba89-0ed5f89f718b";
    return BaseUUID.replace("XXXX", shortUUID);
}

const SV_LATEST_DATA    = UUID("5010"); // Latest Data Service
const CH_LATEST_SENS    = UUID("5012"); // センサーデータ
const CH_LATEST_CALC    = UUID("5013"); // 計算データ

const SV_CONTROL        = UUID("5110"); // Control Service
const CH_LED_NORMAL     = UUID("5111"); // LED setting [normal state]
const CH_LED_EVENT      = UUID("5112");
const CH_LED_OPERATION  = UUID("5113");
const CH_INST_OFFSET    = UUID("5114"); // Installation offset Offset correction
const CH_AD_SETTING     = UUID("5115"); // Advertising setting Interval and mode setting
const CH_MEMORY_RESET   = UUID("5116"); // Memory reset Memory reset

const SV_INFORMATION    = UUID("5400"); // Information Service
const CH_ERROR_STATUS   = UUID("5401"); // Error Status
const CH_INST_DIRECTION = UUID("5402"); // Installation direction(センサ設置方向)
const CH_FLASH_STATUS   = UUID("5403"); // FLASH memory status

// cf. Blocklist: セキュリティ等の懸念により使えないキャラクタリスティック
// https://github.com/WebBluetoothCG/registries/blob/master/gatt_blocklist.txt
// プライバシーの観点でシリアル番号が取得できないようだ
const SV_DEVICE_INFO    = 0x180a;       // Device Information Service
const CH_MODEL_NUMBER   = 0x2a24;       // Model Number String
const CH_SERIAL_NUMBER  = 0x2a25;       // Serial Number String (blocklistにより取得できない)
const CH_FIRMWARE_REV   = 0x2a26;       // Firmware Revision String
const CH_HARDWARE_REV   = 0x2a27;       // Hardware Revision String
const CH_MANUFACTURER   = 0x2a29;       // Manufacturer Name String

// Table 56. FLASH memory status format
const ST_NONE           = 0x00;
const ST_WRITING        = 0x01;
const ST_WRITE_SUCCESS  = 0x02;
const ST_WRITE_FAILURE  = 0x03;
const ST_FLASH_ERASING  = 0x04;

// メッセージ
const MSG_CONNECTING_DEVICE = 0x01;
const MSG_CONNECTING_GATT   = 0x02;
const MSG_CONNECTED         = 0x03;
const MSG_CONNECT_FAILED    = 0x04;
const MSG_DISCONNECTED      = 0x05;
const MSG_NOTIFY_STARTING   = 0x11;
const MSG_NOTIFY_SET_EVENTS = 0x12;
const MSG_NOTIFY_STARTED    = 0x13;
const MSG_WRITE_BYTES       = 0x20;
const MSG_WRITE_SUCCESS     = 0x21;

class MyDevice {
    constructor() {
        this.device = null;
        this.server = null;
    }

    dispatchMessage(type, info) {
        const obj = {type: type, info: info || {}};
        const evt = new CustomEvent("MyDeviceStatusChanged", {detail: obj});
        document.dispatchEvent(evt);
    }

    async connect() {
        // GATTサーバーに接続する
        this.dispatchMessage(MSG_CONNECTING_DEVICE);
        try {
            this.device = await navigator.bluetooth.requestDevice({
                filters: [{name: "Rbt"}],
                optionalServices: [SV_LATEST_DATA, SV_CONTROL, SV_INFORMATION, SV_DEVICE_INFO]
            });
            this.dispatchMessage(MSG_CONNECTING_GATT);
            this.server = await this.device.gatt.connect();
        } catch(e) {
            this.disconnect();
            this.dispatchMessage(MSG_CONNECT_FAILED, {message: e});
            throw e;
        }

        return true;
    }

    disconnect() {
        // GATTサーバーから切断する
        if(this.device && this.device.gatt.connected){
            this.device.gatt.disconnect();
            this.dispatchMessage(MSG_DISCONNECTED);
        }
    }

    async listenNotifications(funcSensor, funcCalc) {
        // Notificationを開始する
        this.dispatchMessage(MSG_NOTIFY_STARTING);
        const svLatestData = await this.server.getPrimaryService(SV_LATEST_DATA);
        const chSens = await svLatestData.getCharacteristic(CH_LATEST_SENS);
        const chCalc = await svLatestData.getCharacteristic(CH_LATEST_CALC);

        this.dispatchMessage(MSG_NOTIFY_SET_EVENTS, {ch: "Latest sensing data"});
        chSens.addEventListener("characteristicvaluechanged", evt => {
            const buf = evt.target.value.buffer;
            const data1 = new Uint16Array(buf.slice(1, 7));
            const data2 = new Uint32Array(buf.slice(7, 11));
            const data3 = new Uint16Array(buf.slice(11, 17));
            const sensor = {
                temperature: (data1[0] / 100).toFixed(2),
                humidity: (data1[1] / 100).toFixed(2),
                light: data1[2],
                pressure: (data2[0] / 1000).toFixed(3),
                noise: (data3[0] / 100).toFixed(2),
                eTVOC: data3[1],
                eCO2: data3[2]
            };
            if(funcSensor){ funcSensor(sensor); }
        });
        // awaitで完了を待たないと2つめがセットされない
        await chSens.startNotifications();

        this.dispatchMessage(MSG_NOTIFY_SET_EVENTS, {ch: "Latest calculation data"});
        chCalc.addEventListener("characteristicvaluechanged", evt => {
            const buf = evt.target.value.buffer;
            const data1 = new Uint16Array(buf.slice(1, 5));
            const calc = {
                thi: (data1[0] / 100).toFixed(2),
                wbgt: (data1[1] / 100).toFixed(2)
            };
            if(funcCalc){ funcCalc(calc); }
        });
        await chCalc.startNotifications();

        this.dispatchMessage(MSG_NOTIFY_STARTED);
    }

    async getDataView(svUUID, chUUID) {
        const service = await this.server.getPrimaryService(svUUID);
        const ch = await service.getCharacteristic(chUUID);
        return await ch.readValue();
    }

    async getString(svUUID, chUUID) {
        // UUID Blocklist
        // https://github.com/WebBluetoothCG/registries/blob/master/gatt_blocklist.txt
        // Serial Numberはプライバシーの観点で取得できないようだ
        if(chUUID == CH_SERIAL_NUMBER){ return "N/A"; }
        const dataview = await this.getDataView(svUUID, chUUID);
        return new TextDecoder().decode(dataview.buffer);
    }

    async writeBytes(svUUID, chUUID, bytes) {
        // Characteristicに書き込む
        const service = await this.server.getPrimaryService(svUUID);
        const ch = await service.getCharacteristic(chUUID);
        await ch.writeValue(bytes.buffer);

        // FLASHへの書き込み完了確認
        const ST = ["NONE", "Writing", "Write success", "Write failure", "Flash memory erasing"];
        const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
        for(let i=0;i<5;i++){
            const dv = await this.getDataView(SV_INFORMATION, CH_FLASH_STATUS);
            console.debug(`writeBytes: ${ST[dv.getUint8(0)]}`);
            if(dv.getUint8(0) == 0x02){ break; }
            await sleep(500);
        }
    }

    hexDump(bytes) {
        // Hexで出力する
        let hex = [];
        for(let i = 0; i < bytes.byteLength; i++){
            hex.push(("0" + bytes[i].toString(16)).slice(-2).toUpperCase());
        }
        return hex.join(" ");
    }

    async getDeviceInformation() {
        // デバイス情報を得る
        return {
            modelNo: await this.getString(SV_DEVICE_INFO, CH_MODEL_NUMBER),
            serialNo: await this.getString(SV_DEVICE_INFO, CH_SERIAL_NUMBER),
            firmwareRev: await this.getString(SV_DEVICE_INFO, CH_FIRMWARE_REV),
            hardwareRev: await this.getString(SV_DEVICE_INFO, CH_HARDWARE_REV),
            manufacturer: await this.getString(SV_DEVICE_INFO, CH_MANUFACTURER)
        };
    }

    async getLEDSettingNormal() {
        // LED setting [normal state]を得る
        const dv = await this.getDataView(SV_CONTROL, CH_LED_NORMAL);
        return {
            displayRule: new Uint16Array(dv.buffer.slice(0, 2))[0],
            red: dv.getUint8(2),
            green: dv.getUint8(3),
            blue: dv.getUint8(4)
        };
    }

    async setLEDSettingNormal(cfg) {
        // LED setting [normal state]に書き込む
        let bytes = new Uint8Array(5);
        bytes.set(Uint16Array.from([cfg.displayRule]), 0);
        bytes.set(Uint8Array.from([cfg.red, cfg.green, cfg.blue]), 2);
        console.debug(`setLEDSettingNormal: ${this.hexDump(bytes)}`);
        const msg = {ch: "LED setting [normal state]", data: this.hexDump(bytes)};
        this.dispatchMessage(MSG_WRITE_BYTES, msg);
        await this.writeBytes(SV_CONTROL, CH_LED_NORMAL, bytes);
        this.dispatchMessage(MSG_WRITE_SUCCESS, msg);
    }

    async getLEDSettingOperation() {
        // LED state [operation]を得る
        const dv = await this.getDataView(SV_CONTROL, CH_LED_OPERATION);
        return {
            startUp: dv.getUint8(0),
            error: dv.getUint8(1),
            connection: dv.getUint8(2)
        };
    }

    async setLEDSettingOperation(cfg) {
        // LED state [operation]に書き込む
        let bytes = Uint8Array.from([cfg.startUp, cfg.error, cfg.connection]);
        console.debug(`setLEDSettingOperation: ${this.hexDump(bytes)}`);
        const msg = {ch: "LED state [operation]", data: this.hexDump(bytes)};
        this.dispatchMessage(MSG_WRITE_BYTES, msg);
        await this.writeBytes(SV_CONTROL, CH_LED_OPERATION, bytes);
        this.dispatchMessage(MSG_WRITE_SUCCESS, msg);
    }

    async getAdvertiseSetting() {
        // Advertise settingを得る
        const dv = await this.getDataView(SV_CONTROL, CH_AD_SETTING);
        return {
            adInterval: new Uint16Array(dv.buffer.slice(0, 2))[0],
            adMode: dv.getUint8(2)
        };
    }

    async setAdvertiseSetting(cfg) {
        // Advertise settingに書き込む
        let bytes = new Uint8Array(3);
        bytes.set(Uint16Array.from([cfg.adInterval]), 0);
        bytes.set(Uint8Array.from([cfg.adMode]), 2);
        console.debug(`setAdvertiseSetting: ${this.hexDump(bytes)}`);
        const msg = {ch: "Advertise setting", data: this.hexDump(bytes)};
        this.dispatchMessage(MSG_WRITE_BYTES, msg);
        await this.writeBytes(SV_CONTROL, CH_AD_SETTING, bytes);
        this.dispatchMessage(MSG_WRITE_SUCCESS, msg);
    }
}
