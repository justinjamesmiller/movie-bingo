import { Component, lazy, Suspense } from 'react';
import ModalShell from './ModalShell.jsx';

export function lazyTool(load) {
  let Tool = lazy(load);
  class ToolBoundary extends Component {
    state = { failed: false };
    static getDerivedStateFromError() {
      return { failed: true };
    }
    retry = () => {
      Tool = lazy(load);
      this.setState({ failed: false });
    };
    render() {
      if (!this.state.failed) return this.props.renderTool();
      return (
        <ModalShell onClose={this.props.close}>
          <div className="modal-content">
            <p role="alert">Could not load this tool. Check your connection and try again.</p>
            <button className="btn" onClick={this.retry}>
              Retry
            </button>
            {this.props.close && (
              <button className="btn" onClick={this.props.close}>
                Cancel
              </button>
            )}
          </div>
        </ModalShell>
      );
    }
  }
  return function DeferredTool(props) {
    const close = props.onClose || props.onCancel;
    return (
      <ToolBoundary
        close={close}
        renderTool={() => (
          <Suspense
            fallback={
              <ModalShell onClose={close}>
                <div className="modal-content">
                  <p role="status">Loading...</p>
                  {close && (
                    <button className="btn" onClick={close}>
                      Cancel
                    </button>
                  )}
                </div>
              </ModalShell>
            }
          >
            <Tool {...props} />
          </Suspense>
        )}
      />
    );
  };
}
