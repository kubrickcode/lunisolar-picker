const SETTLE_FRAMES = 2;

// Goal: 부정 단언 전에 늦게 도는 passive effect의 알림까지 기다림
export const settleEffects = async (): Promise<void> => {
  for (let frame = 0; frame < SETTLE_FRAMES; frame += 1) {
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }
};
