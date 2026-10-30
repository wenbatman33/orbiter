// 迫降下降曲線：由速度分佈積分而成，全程速度連續，不會突然往下掉
// 階段：慢慢離開軌道 → 穩定下滑 → 開傘減速 → 輕輕落地

const smooth = (x) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};

// reentryAt / chuteAt 為佔總時間的比例；回傳 0~1 的進度表
export function buildDescentCurve(reentryAt, chuteAt, steps = 240) {
  const speed = (u) => {
    const glide = smooth(u / Math.max(0.01, reentryAt)); // 0 → 1：慢慢離開軌道
    const brake = 1 - 0.4 * smooth((u - chuteAt) / 0.1); // 1 → 0.6：開傘減速
    const settle = 1 - 0.75 * smooth((u - chuteAt - 0.1) / Math.max(0.01, 1 - chuteAt - 0.1)); // 0.6 → 0.15：接近地面
    return glide * brake * settle;
  };
  const table = [0];
  for (let i = 1; i <= steps; i++) table.push(table[i - 1] + speed((i - 0.5) / steps));
  return table.map((v) => v / table[steps]);
}

// 查表取得進度 u（0~1）對應的下降比例
export function descentAt(curve, u) {
  const x = Math.min(1, Math.max(0, u)) * (curve.length - 1);
  const i = Math.min(curve.length - 2, Math.floor(x));
  return curve[i] + (curve[i + 1] - curve[i]) * (x - i);
}
