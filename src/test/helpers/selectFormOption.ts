import { screen } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';

export async function selectFormOption(
  user: UserEvent,
  label: string | RegExp,
  optionName: string | RegExp,
) {
  await user.click(screen.getByLabelText(label));
  await user.click(screen.getByRole('option', { name: optionName }));
}

export async function selectFormOptionByValue(
  user: UserEvent,
  label: string | RegExp,
  value: string,
) {
  const field = await screen.findByLabelText(label);
  await user.click(field);
  const option = screen.getAllByRole('option').find((entry) => entry.getAttribute('data-value') === value);
  if (!option) {
    throw new Error(`Option with value "${value}" not found for ${String(label)}`);
  }
  await user.click(option);
}

export async function openFormSelect(user: UserEvent, label: string | RegExp) {
  const field = await screen.findByLabelText(label);
  await user.click(field);
}
