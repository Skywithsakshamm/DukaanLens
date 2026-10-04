import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api/api-client';
import { AssistantMessage, AssistantProposal } from '../../shared/types';

export const AssistantPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const initialQuery = searchParams.get('q');

  const [messages, setMessages] = useState<AssistantMessage[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: 'Namaste! Main DukaanLens AI assistant hoon. Aap mujhse stock checking ("1K Resistor kitne bache?"), reorder recommendations ("Kya mangwana hai?"), ya stock update ("20 LED add karo") pooch sakte hain.',
      language: 'hinglish',
      timestamp: new Date().toISOString()
    }
  ]);
  const [inputPrompt, setInputPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingStatus, setRecordingStatus] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  useEffect(() => {
    if (initialQuery) {
      sendMessage(initialQuery);
    }
  }, []);

  const sendMessage = async (textToSend: string) => {
    if (!textToSend.trim()) return;

    const userMsg: AssistantMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: textToSend.trim(),
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMsg]);
    setInputPrompt('');
    setLoading(true);

    try {
      const res = await api.assistant.query(textToSend.trim());
      setMessages(prev => [...prev, res.message]);
    } catch (err: any) {
      setMessages(prev => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: 'assistant',
          text: `⚠️ Maaf kijiye, error aaya: ${err.message || 'AI request failed'}. Kripya dobara try karein.`,
          language: 'hinglish',
          timestamp: new Date().toISOString()
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmProposal = async (proposal: AssistantProposal, msgId: string) => {
    try {
      const res = await api.assistant.confirmProposal(proposal.proposalId);
      // Update proposal status in message state
      setMessages(prev =>
        prev.map(m => {
          if (m.id === msgId && m.proposal) {
            return {
              ...m,
              proposal: {
                ...m.proposal,
                status: 'confirmed'
              }
            };
          }
          return m;
        })
      );
      // Add confirmation reply
      setMessages(prev => [
        ...prev,
        {
          id: `confirmed-${Date.now()}`,
          sender: 'assistant',
          text: `✓ ${res.message}`,
          language: 'hinglish',
          timestamp: new Date().toISOString()
        }
      ]);
    } catch (err: any) {
      alert(err.message || 'Failed to confirm proposal.');
    }
  };

  const handleRejectProposal = async (proposal: AssistantProposal, msgId: string) => {
    try {
      await api.assistant.rejectProposal(proposal.proposalId);
      setMessages(prev =>
        prev.map(m => {
          if (m.id === msgId && m.proposal) {
            return {
              ...m,
              proposal: {
                ...m.proposal,
                status: 'rejected'
              }
            };
          }
          return m;
        })
      );
    } catch (err: any) {
      alert(err.message || 'Failed to cancel proposal.');
    }
  };

  // Voice Web Speech API Setup
  const toggleVoice = () => {
    if (isRecording) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsRecording(false);
      setRecordingStatus(null);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser. Please type your query in the text box.');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'hi-IN'; // Hindi / Indian English recognition
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => {
        setIsRecording(true);
        setRecordingStatus('Listening... Speak now in Hindi or English');
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setIsRecording(false);
        setRecordingStatus(null);
        if (transcript) {
          sendMessage(transcript);
        }
      };

      recognition.onerror = (event: any) => {
        setIsRecording(false);
        setRecordingStatus(null);
        console.warn('Speech error:', event.error);
        if (event.error !== 'no-speech') {
          alert(`Microphone error: ${event.error}. You can type your question directly.`);
        }
      };

      recognition.onend = () => {
        setIsRecording(false);
        setRecordingStatus(null);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      setIsRecording(false);
      setRecordingStatus(null);
      console.error(err);
    }
  };

  return (
    <div className="app-container" style={{ maxWidth: '800px' }}>
      <div style={{ marginBottom: '16px' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--secondary)' }}>
          💬 DukaanLens Assistant
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          Ask in Hindi, English or Hinglish about stock, reorders, or prices
        </p>
      </div>

      <div className="chat-window">
        {/* Messages Container */}
        <div className="chat-messages">
          {messages.map(msg => (
            <div key={msg.id} className={`message-bubble ${msg.sender}`}>
              <div>{msg.text}</div>

              {/* Mutation Proposal Card if AI formulated a transaction proposal */}
              {msg.proposal && (
                <div className="proposal-card">
                  <div style={{ fontWeight: 800, fontSize: '0.95rem', marginBottom: '4px' }}>
                    ⚡ Proposed Stock Action
                  </div>
                  <div style={{ fontSize: '0.88rem', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <div>Product: <strong>{msg.proposal.productName}</strong></div>
                    <div>Quantity Change: <strong>{msg.proposal.direction === 'in' ? '+' : '-'}{msg.proposal.quantity} units</strong></div>
                    <div>Stock Effect: <strong>{msg.proposal.currentStock} → {msg.proposal.newStock}</strong></div>
                  </div>

                  {msg.proposal.status === 'pending' ? (
                    <div className="proposal-actions">
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => handleConfirmProposal(msg.proposal!, msg.id)}
                      >
                        ✓ Confirm Stock Change
                      </button>
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => handleRejectProposal(msg.proposal!, msg.id)}
                      >
                        ✕ Cancel
                      </button>
                    </div>
                  ) : (
                    <div style={{ marginTop: '8px', fontSize: '0.8rem', fontWeight: 700, color: msg.proposal.status === 'confirmed' ? 'var(--success)' : 'var(--text-muted)' }}>
                      {msg.proposal.status === 'confirmed' ? '✓ Confirmed and committed to inventory ledger' : '✕ Proposal cancelled'}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="message-bubble assistant" style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>
              🤖 Assistant is checking inventory data...
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Suggestion Chips */}
        <div className="quick-chips">
          <button className="quick-chip" onClick={() => sendMessage('Kya mangwana hai?')}>
            📦 Kya mangwana hai?
          </button>
          <button className="quick-chip" onClick={() => sendMessage('1K resistor kitne bache?')}>
            🔍 1K resistor kitne bache?
          </button>
          <button className="quick-chip" onClick={() => sendMessage('Low stock items dikhao')}>
            ⚠️ Low stock dikhao
          </button>
          <button className="quick-chip" onClick={() => sendMessage('Aaj stock mein kya add hua?')}>
            📅 Aaj kya add hua?
          </button>
          <button className="quick-chip" onClick={() => sendMessage('ABC Electronics se last purchase kab aayi thi?')}>
            🚚 ABC Electronics order history
          </button>
        </div>

        {/* Voice recording status banner */}
        {recordingStatus && (
          <div style={{ padding: '8px 16px', backgroundColor: 'var(--danger-light)', color: 'var(--danger)', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ animation: 'pulse 1s infinite' }}>🔴</span> {recordingStatus}
          </div>
        )}

        {/* Chat Input Bar */}
        <form
          className="chat-input-bar"
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage(inputPrompt);
          }}
        >
          <button
            type="button"
            className={`mic-btn ${isRecording ? 'recording' : ''}`}
            onClick={toggleVoice}
            title={isRecording ? 'Stop Recording' : 'Voice Input (Hindi/English)'}
          >
            {isRecording ? '⏹' : '🎤'}
          </button>

          <input
            type="text"
            className="form-input"
            placeholder="Type or speak a question (e.g. '1K resistor kitne bache?')..."
            value={inputPrompt}
            onChange={e => setInputPrompt(e.target.value)}
            disabled={loading}
          />

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading || !inputPrompt.trim()}
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
};
