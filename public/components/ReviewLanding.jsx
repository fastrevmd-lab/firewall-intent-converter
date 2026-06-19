import React from 'react';

/**
 * ReviewLanding — Step-3 decision panel shown after Analysis is applied.
 * AI-enabled: offers "Review with LLM" or "Skip to SRX edit".
 * No-AI: LLM action disabled + struck through, with a subtle link to enable AI,
 * plus "Continue to SRX edit".
 *
 * @param {object} props
 * @param {number} props.findingsCount - applied analysis finding count
 * @param {boolean} props.deterministic - No-AI mode
 * @param {boolean} props.localOnly - local-only LLM mode (affects accent)
 * @param {() => void} props.onReview - run the LLM review
 * @param {() => void} props.onSkip - advance to SRX edit
 * @param {() => void} props.onEnableAI - open the AI mode chooser
 * @returns {JSX.Element}
 */
export default function ReviewLanding({ findingsCount, deterministic, localOnly, onReview, onSkip, onEnableAI }) {
  const reviewClass = `btn btn-translate${localOnly ? ' llm-local' : ''}`;
  return (
    <div className="review-landing">
      {deterministic && <div className="review-landing-tag">NO-AI MODE</div>}
      <h3>Analysis complete{findingsCount > 0 ? ` \u2014 ${findingsCount} findings applied` : ''}</h3>
      <p>
        {deterministic
          ? 'LLM review is turned off in this mode. Continue to editing the SRX config.'
          : 'Optionally run an LLM review of the proposed policies, or skip straight to editing the SRX config.'}
      </p>
      <div className="review-landing-actions">
        {deterministic ? (
          <>
            <div className="review-landing-llm-group">
              <button className="btn review-llm-off" disabled>Review with LLM</button>
              <span className="review-enable-link" role="button" tabIndex={0}
                onClick={onEnableAI}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onEnableAI(); }}
              >Enable AI in Settings &rarr;</span>
            </div>
            <button className="btn btn-primary" onClick={onSkip}>Continue to SRX edit &rarr;</button>
          </>
        ) : (
          <>
            <button className={reviewClass} onClick={onReview}>Review with LLM</button>
            <button className="btn btn-secondary" onClick={onSkip}>Skip to SRX edit &rarr;</button>
          </>
        )}
      </div>
    </div>
  );
}
