import { Router, Response } from 'express';
import { assistantService } from './assistant.service';
import { AuthenticatedRequest, requireAuth } from '../auth/auth.middleware';

export const assistantRouter = Router();

// POST /api/assistant/query
assistantRouter.post('/query', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { prompt } = req.body;
    if (!prompt) {
      res.status(400).json({
        error: {
          code: 'INVALID_QUERY',
          message: 'Prompt message is required.'
        }
      });
      return;
    }

    const message = await assistantService.query(prompt, req.user?.username || 'user');
    res.json({ message });
  } catch (err: any) {
    res.status(500).json({
      error: {
        code: 'ASSISTANT_ERROR',
        message: err.message || 'Failed to process assistant query.'
      }
    });
  }
});

// POST /api/assistant/confirm-proposal
assistantRouter.post('/confirm-proposal', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { proposalId } = req.body;
    if (!proposalId) {
      res.status(400).json({
        error: {
          code: 'INVALID_PROPOSAL_ID',
          message: 'proposalId is required.'
        }
      });
      return;
    }

    const result = assistantService.confirmProposal(proposalId, req.user?.username || 'user');
    res.json(result);
  } catch (err: any) {
    res.status(400).json({
      error: {
        code: 'PROPOSAL_CONFIRM_FAILED',
        message: err.message || 'Failed to confirm proposal.'
      }
    });
  }
});

// POST /api/assistant/reject-proposal
assistantRouter.post('/reject-proposal', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { proposalId } = req.body;
    const result = assistantService.rejectProposal(proposalId, req.user?.username || 'user');
    res.json(result);
  } catch (err: any) {
    res.status(400).json({
      error: {
        code: 'PROPOSAL_REJECT_FAILED',
        message: err.message || 'Failed to cancel proposal.'
      }
    });
  }
});
