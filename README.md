# OMRON 2JCIE-BU01用Webインタフェース

OMRON 2JCIE-BU01をWeb Bluetooth APIを使って操作するためのWebインタフェースです。

- OMRON 2JCIE-BU01 -- 2025年01月で受注終了みたいです…
  - 製品サイト -- https://www.fa.omron.co.jp/products/family/3724/lineup.html
  - ダウンロードサイト -- https://components.omron.com/jp-ja/products/sensors/2JCIE-BU
  - 生産終了案内(PDF) -- https://www.fa.omron.co.jp/data_pdf/closed/2024004c_on.pdf


## 概要

Web Bluetooth APIの動作検証のために実装してみました。GATTサーバーにアクセスできるため、大抵のことはできるみたいです。標準設定ではアドバタイズパケットの解析ができなさそうなので、測定データ取得はGATTサーバーに接続し、Notifyでデータを受けるようにしました。

ブラウザの標準設定で使用可能です。#enable-experimental-web-platform-features パラメータがdisable(ディフォルト)のままで使用できます。

以下のことができます。

- 測定データの表示
- いくつかの設定の更新
- デバイス情報の表示

[Web Bluetooth API](https://developer.mozilla.org/ja/docs/Web/API/Web_Bluetooth_API)を使っているため、Chrome 59以上、Edge 79以上、およびChrome Android 56で動作します。動作検証は、以下の環境で行いました。

- Microsoft Windows 10 Professional(22H2) + Microsoft Edge 120
- Google Pixel 6a (Android 14) + Google Chrome Android 120


## 使い方

Webページを開き、"Connect to 2JCIE-BU01"をクリックすると、接続を開始するので、「Rbt」を選択し、「ペアリング」をクリックして下さい。しばらくするとデバイスに接続され、測定情報が表示されます。

表示データはNotifyを使用しているため、自動で更新されます。


### デバイス設定の変更

Controlタブを開くとデバイスの設定を変更できます。デバイス設定はデバイスのフラッシュメモリに書き込まれるため、電源を切っても有効です。以下の設定を変更できます。

- LED setting [normal state] -- 通常状態のLEDの光り方設定
- LED setting [operation] -- スタートアップ時などの動作設定
- Advertise setting -- アドバタイズの間隔やモードの設定

### デバイス情報の表示

Infoタブを開くと、以下の情報を表示できます。

- モデル番号 [2JCIE-BU01]
- ファームウェアリビジョン [00.70や00.72]
- ハードウェアリビジョン [01.00]
- 製造者 [OMRON]

シリアル番号はWeb Bluetooth APIのブロックリストによる制限のため取得できないみたいです。

- https://stackoverflow.com/questions/56405266/how-to-fix-domexception-error-in-web-bluetooth-api
