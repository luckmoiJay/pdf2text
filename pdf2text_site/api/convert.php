<?php
// 保留（非必需）：若未來要改回伺服器端處理可擴充此檔。
// 目前純前端運作，這裡僅做健康檢查。
header('Content-Type: application/json; charset=UTF-8');
echo json_encode(['ok' => true, 'msg' => '前端版不需伺服器轉檔。'], JSON_UNESCAPED_UNICODE);
