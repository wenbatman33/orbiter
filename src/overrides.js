// DEV 微調數值的本機暫存（localStorage），重新整理後仍保留
const KEY = 'orbiter.devOverrides.v1';

function merge(dst, src) {
  for (const k of Object.keys(dst)) {
    if (!(k in src)) continue;
    const d = dst[k], s = src[k];
    if (d && typeof d === 'object') {
      if (s && typeof s === 'object') merge(d, s);
    } else if (typeof s === typeof d) {
      dst[k] = s;
    }
  }
}

export function loadOverrides(targets) {
  let data = null;
  try {
    data = JSON.parse(localStorage.getItem(KEY) || 'null');
  } catch {
    return false;
  }
  if (!data) return false;
  for (const name of Object.keys(targets)) if (data[name]) merge(targets[name], data[name]);
  return true;
}

export function saveOverrides(targets) {
  try {
    localStorage.setItem(KEY, JSON.stringify(targets));
  } catch {
    // 無痕模式等情況寫不進去就略過
  }
}

export function clearOverrides() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // 略過
  }
}
