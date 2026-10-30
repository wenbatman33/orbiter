// 地面通訊台詞表：瀏覽器（comms.js）與語音產生腳本（scripts/gen_voice.mjs）共用
// who：houston 地面中心 / pilot 飛行員；reply：這句結束後由飛行員回覆的台詞 id
// 台詞刻意保持簡短：飛行聲音才是主角，通訊只是點綴
// rate：語速（每分鐘字數），緊急台詞較快

export const VOICES = { houston: 'Reed (英文（美國）)', pilot: 'Samantha' };
export const CALLSIGN = { houston: 'HOUSTON 休士頓', pilot: 'ORBITER 軌道者號' };

export const LINES = {
  // 任務開始
  start1: { who: 'houston', en: 'Orbiter, you are go.', zh: '軌道者號，可以出發。', reply: 'p_roger' },
  start2: { who: 'houston', en: 'Telemetry good. Fly safe.', zh: '遙測正常，飛行平安。', reply: 'p_copy' },
  start_combat: { who: 'houston', en: 'Debris ahead. Weapons free.', zh: '前方碎片帶，武器解禁。', reply: 'p_copy' },
  // 能量
  low1: { who: 'houston', en: 'Power low. Grab cells.', zh: '能量偏低，收集晶體。', reply: 'p_copy' },
  low2: { who: 'houston', en: 'Power dropping.', zh: '能量下降中。' },
  crit: { who: 'houston', en: 'Power critical!', zh: '能量臨界！', rate: 195 },
  // 受擊
  hit1: { who: 'houston', en: 'Impact. Check hull.', zh: '遭到撞擊，檢查船體。' },
  hit2: { who: 'houston', en: 'Stay sharp.', zh: '保持警覺。' },
  hit3: { who: 'houston', en: 'That was close.', zh: '好險。' },
  // 進度
  level1: { who: 'houston', en: 'Velocity increasing.', zh: '速度提升。' },
  level2: { who: 'houston', en: 'Speed up. Stay steady.', zh: '加速中，保持穩定。' },
  lap1: { who: 'houston', en: 'One orbit complete.', zh: '完成一圈。', reply: 'p_view' },
  lap2: { who: 'houston', en: 'Orbit complete. Nice flying.', zh: '繞行完成，飛得好。', reply: 'p_thanks' },
  record: { who: 'houston', en: 'New mission record.', zh: '新任務紀錄。', reply: 'p_thanks' },
  // 危險與道具
  meteor1: { who: 'houston', en: 'Meteor inbound!', zh: '流星來襲！', rate: 205 },
  meteor2: { who: 'houston', en: 'Incoming! Move!', zh: '有東西接近！快閃！', rate: 205 },
  debris: { who: 'houston', en: 'Debris on your path.', zh: '航道上有太空垃圾。' },
  shield: { who: 'houston', en: 'Shield online.', zh: '護盾上線。' },
  kill1: { who: 'houston', en: 'Good shot.', zh: '打得好。' },
  kill2: { who: 'houston', en: 'Target down.', zh: '擊落目標。' },
  // 閒聊
  idle1: { who: 'houston', en: 'All systems nominal.', zh: '所有系統正常。', reply: 'p_roger' },
  idle2: { who: 'houston', en: 'Flight path looks good.', zh: '航線良好。' },
  idle3: { who: 'houston', en: 'Looking good up there.', zh: '看起來不錯。', reply: 'p_thanks' },
  idle4: { who: 'houston', en: 'Clear skies over the Pacific.', zh: '太平洋上空晴朗。', reply: 'p_view' },
  // 緊急迫降
  abort: { who: 'houston', en: 'Power gone. Prepare for emergency landing.', zh: '能量耗盡，準備緊急迫降。', reply: 'p_abort', rate: 190 },
  chute: { who: 'pilot', en: 'Chutes out.', zh: '降落傘已展開。' },
  touchdown: { who: 'houston', en: 'Touchdown. Welcome home.', zh: '確認著陸，歡迎回家。' },
  splashdown: { who: 'houston', en: 'Splashdown. Welcome home.', zh: '確認濺落，歡迎回家。' },
  // 飛行員回覆
  p_roger: { who: 'pilot', en: 'Roger.', zh: '收到。' },
  p_copy: { who: 'pilot', en: 'Copy.', zh: '了解。' },
  p_thanks: { who: 'pilot', en: 'Thanks, Houston.', zh: '謝謝，休士頓。' },
  p_view: { who: 'pilot', en: 'Beautiful view.', zh: '景色真美。' },
  p_abort: { who: 'pilot', en: 'Copy. Going down.', zh: '收到，開始下降。' },
};
