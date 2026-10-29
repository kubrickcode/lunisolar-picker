// Goal: 잘못된 API 호출(프로그래머 오류)만 던짐. 사용자 입력 실패는 Result로 돌려줌 (스펙 5.5)
export class LunisolarPickerError extends RangeError {
  override readonly name: string = 'LunisolarPickerError';
}
