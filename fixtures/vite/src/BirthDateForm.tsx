import { ko } from '@lunisolar-picker/core/locales/ko';
import { LunisolarProvider } from '@lunisolar-picker/react';
import { DatePicker } from '@lunisolar-picker/react/pickers';
import { Controller, useForm } from 'react-hook-form';

interface BirthDateValues {
  readonly birthDate: string | null;
}

interface BirthDateFormProps {
  readonly onSubmitValues?: (values: BirthDateValues) => void;
}

// Constraint: 서버 렌더와 브라우저 렌더가 같은 '오늘'을 쓰도록 고정함 (스펙 11장)
const FIXED_TODAY = '2026-10-14';
const INITIAL_BIRTH_DATE = '1990-03-15';

export function BirthDateForm({ onSubmitValues }: BirthDateFormProps) {
  const { control, handleSubmit } = useForm<BirthDateValues>({ defaultValues: { birthDate: INITIAL_BIRTH_DATE } });
  return (
    <LunisolarProvider locale={ko} timeZone="Asia/Seoul" today={FIXED_TODAY}>
      {/* Constraint: required가 숨은 입력의 네이티브 검증을 켜므로 noValidate가 없으면 브라우저가 submit을 막아 react-hook-form 검증 메시지가 나오지 않음 */}
      <form noValidate onSubmit={handleSubmit((values) => onSubmitValues?.(values))}>
        <Controller
          name="birthDate"
          control={control}
          rules={{ required: '생년월일을 입력하세요' }}
          render={({ field, fieldState }) => (
            <>
              <DatePicker
                ref={field.ref}
                name={field.name}
                value={field.value}
                onValueChange={(value) => field.onChange(value)}
                onBlur={field.onBlur}
                required
                invalid={fieldState.invalid}
                max={FIXED_TODAY}
              />
              {fieldState.error && <p role="alert">{fieldState.error.message}</p>}
            </>
          )}
        />
        <button type="submit">제출</button>
      </form>
    </LunisolarProvider>
  );
}
