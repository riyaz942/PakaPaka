import { fireEvent, render, screen } from '@testing-library/react-native';
import { openDatabaseAsync } from 'expo-sqlite';
import React from 'react';

import { __mockResetSqlite } from '../../../__mocks__/expo-sqlite';

import { PersonalMnemonicEditor } from '@/components/learn/PersonalMnemonicEditor';
import { migration001Initial } from '@/data/migrations/001_initial';
import { runMigrations } from '@/data/migrations/migrationRunner';
import { getPersonalMnemonic, setPersonalMnemonic } from '@/data/user/mnemonicRepository';
import { DatabaseContext, type DatabaseContextValue } from '@/providers/DatabaseContext';

async function renderEditor() {
  const userDb = await openDatabaseAsync('user.db');
  const result = runMigrations(userDb, [migration001Initial]);
  expect(result.ok).toBe(true);
  return { userDb };
}

function mount(userDb: Awaited<ReturnType<typeof openDatabaseAsync>>) {
  const contextValue = {
    curriculumDb: userDb,
    userDb,
    isReady: true,
    error: null,
  } as unknown as DatabaseContextValue;

  return render(
    <DatabaseContext.Provider value={contextValue}>
      <PersonalMnemonicEditor itemId="2" />
    </DatabaseContext.Provider>,
  );
}

describe('PersonalMnemonicEditor content states', () => {
  beforeEach(() => {
    __mockResetSqlite();
  });

  it('shows a muted invitation when no personal mnemonic exists', async () => {
    const { userDb } = await renderEditor();
    mount(userDb);

    expect(screen.getByTestId('personal-mnemonic-empty')).toBeTruthy();
    expect(screen.queryByTestId('personal-mnemonic-input')).toBeNull();
    expect(screen.queryByTestId('personal-mnemonic-delete')).toBeNull();
  });

  it('saves a new mnemonic and shows the saved state', async () => {
    const { userDb } = await renderEditor();
    mount(userDb);

    fireEvent.press(screen.getByTestId('personal-mnemonic-empty'));
    fireEvent.changeText(screen.getByTestId('personal-mnemonic-input'), 'My own hook');
    fireEvent.press(screen.getByTestId('personal-mnemonic-save'));

    expect(screen.getByTestId('personal-mnemonic-text')).toBeTruthy();
    expect(screen.getByText('My own hook')).toBeTruthy();
    expect(getPersonalMnemonic(userDb, '2')).toBe('My own hook');
  });

  it('disables Save while the editor is empty', async () => {
    const { userDb } = await renderEditor();
    mount(userDb);

    fireEvent.press(screen.getByTestId('personal-mnemonic-empty'));
    const save = screen.getByTestId('personal-mnemonic-save');
    expect(save.props.accessibilityState.disabled).toBe(true);

    fireEvent.changeText(screen.getByTestId('personal-mnemonic-input'), '   ');
    expect(screen.getByTestId('personal-mnemonic-save').props.accessibilityState.disabled).toBe(
      true,
    );

    fireEvent.changeText(screen.getByTestId('personal-mnemonic-input'), 'ok');
    expect(screen.getByTestId('personal-mnemonic-save').props.accessibilityState.disabled).toBe(
      false,
    );
  });

  it('edits an existing mnemonic', async () => {
    const { userDb } = await renderEditor();
    setPersonalMnemonic(userDb, '2', 'Original');
    mount(userDb);

    expect(screen.getByText('Original')).toBeTruthy();

    fireEvent.press(screen.getByTestId('personal-mnemonic-edit'));
    fireEvent.changeText(screen.getByTestId('personal-mnemonic-input'), 'Rewritten');
    fireEvent.press(screen.getByTestId('personal-mnemonic-save'));

    expect(screen.getByText('Rewritten')).toBeTruthy();
    expect(getPersonalMnemonic(userDb, '2')).toBe('Rewritten');
  });

  it('confirms before deleting and can be cancelled', async () => {
    const { userDb } = await renderEditor();
    setPersonalMnemonic(userDb, '2', 'Original');
    mount(userDb);

    fireEvent.press(screen.getByTestId('personal-mnemonic-delete'));
    expect(screen.getByTestId('personal-mnemonic-delete-confirm')).toBeTruthy();
    expect(getPersonalMnemonic(userDb, '2')).toBe('Original');

    fireEvent.press(screen.getByTestId('personal-mnemonic-delete-cancel'));
    expect(screen.queryByTestId('personal-mnemonic-delete-confirm')).toBeNull();
    expect(getPersonalMnemonic(userDb, '2')).toBe('Original');

    fireEvent.press(screen.getByTestId('personal-mnemonic-delete'));
    fireEvent.press(screen.getByTestId('personal-mnemonic-delete-confirm'));

    expect(getPersonalMnemonic(userDb, '2')).toBeNull();
    expect(screen.getByTestId('personal-mnemonic-empty')).toBeTruthy();
  });
});
