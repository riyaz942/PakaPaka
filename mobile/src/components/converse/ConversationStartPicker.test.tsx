import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import {
  ConversationStartPicker,
  type ConversationStartRequest,
} from '@/components/converse/ConversationStartPicker';
import type { RecentGrammarItem } from '@/data/ai/recentGrammarRepository';

function grammar(itemId: string, primaryForm: string, meaning: string): RecentGrammarItem {
  return { itemId, primaryForm, meaning, lastTouchedAt: '2026-07-20T00:00:00.000Z' };
}

const RECENT = [grammar('g1', 'て form', 'connecting verbs'), grammar('g2', '〜たい', 'want to')];
const ALL = [...RECENT, grammar('g3', '〜ながら', 'while doing')];

describe('ConversationStartPicker', () => {
  it('pins every recent grammar item onto the start request', () => {
    const onStart = jest.fn();
    render(<ConversationStartPicker recentGrammar={RECENT} allGrammar={ALL} onStart={onStart} />);

    fireEvent.press(screen.getByTestId('start-practise_recent_grammar'));

    // The prompt is grounded in the whole set, so the whole set is what gets
    // persisted — otherwise a resume re-derives a different scene.
    expect(onStart).toHaveBeenCalledWith({
      mode: 'practise_recent_grammar',
      topicItemId: 'g1',
      topicItemIds: ['g1', 'g2'],
    } satisfies ConversationStartRequest);
  });

  it('disables recent-grammar practice when there is no recent grammar', () => {
    const onStart = jest.fn();
    render(<ConversationStartPicker recentGrammar={[]} allGrammar={ALL} onStart={onStart} />);

    const option = screen.getByTestId('start-practise_recent_grammar');
    expect(option.props.accessibilityState.disabled).toBe(true);
    fireEvent.press(option);
    expect(onStart).not.toHaveBeenCalled();
    expect(screen.getByText(/once you have studied some grammar/i)).toBeTruthy();
  });

  it('starts a chosen-grammar session from the sheet', () => {
    const onStart = jest.fn();
    render(<ConversationStartPicker recentGrammar={RECENT} allGrammar={ALL} onStart={onStart} />);

    fireEvent.press(screen.getByTestId('start-choose_grammar'));
    fireEvent.press(screen.getByTestId('choose-grammar-g3'));

    expect(onStart).toHaveBeenCalledWith({
      mode: 'choose_grammar',
      topicItemId: 'g3',
      topicItemIds: ['g3'],
    } satisfies ConversationStartRequest);
  });

  it('disables choose-grammar when the curriculum offers nothing to pick', () => {
    const onStart = jest.fn();
    render(<ConversationStartPicker recentGrammar={RECENT} allGrammar={[]} onStart={onStart} />);

    const option = screen.getByTestId('start-choose_grammar');
    expect(option.props.accessibilityState.disabled).toBe(true);
    fireEvent.press(option);
    // The sheet's own copy, not the option title, which reads the same.
    expect(screen.queryByText(/Pick the point you want this conversation/i)).toBeNull();
  });

  it('says the grammar read failed rather than claiming there is none', () => {
    render(
      <ConversationStartPicker
        recentGrammar={[]}
        allGrammar={[]}
        grammarLoadFailed
        onStart={jest.fn()}
      />,
    );

    expect(screen.getByText(/Could not load your grammar/i)).toBeTruthy();
    expect(screen.queryByText(/once you have studied some grammar/i)).toBeNull();
    // The non-grammar ways to start are unaffected by a grammar read failing.
    expect(screen.getByTestId('start-random').props.accessibilityState.disabled).toBe(false);
  });

  it('leaves the ungrounded modes available and unpinned', () => {
    const onStart = jest.fn();
    render(<ConversationStartPicker recentGrammar={RECENT} allGrammar={ALL} onStart={onStart} />);

    fireEvent.press(screen.getByTestId('start-role_play'));

    expect(onStart).toHaveBeenCalledWith({ mode: 'role_play' });
  });
});
