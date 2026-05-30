"use client";

import React from "react";

type Props = {
  /** Any change to this string resets the boundary's error state. */
  dep: string;
  children: React.ReactNode;
};

type State = { err: boolean };

/**
 * Wraps the bubbles / heatmap so a bad filter combo can never blank the page.
 * Resets automatically whenever the controls change (dep prop differs).
 */
export class VizBoundary extends React.Component<Props, State> {
  state: State = { err: false };

  static getDerivedStateFromError(): State {
    return { err: true };
  }

  componentDidUpdate(prev: Props) {
    if (prev.dep !== this.props.dep && this.state.err) {
      this.setState({ err: false });
    }
  }

  render() {
    if (this.state.err) {
      return (
        <div className="empty">
          Couldn&apos;t render this view — try another timeframe or filter.
        </div>
      );
    }
    return this.props.children;
  }
}
