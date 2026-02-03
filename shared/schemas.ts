import { z } from 'zod';
import { APP_CONFIG } from './config.js';

export const CreateRoomSchema = z.object({
    name: z.string().min(1, "Name is required").max(24, "Name must be 24 characters or less").trim()
});

export const JoinRoomSchema = z.object({
    roomId: z.string().length(4, "Room code must be 4 characters"),
    name: z.string().min(1, "Name is required").max(24, "Name must be 24 characters or less").trim()
});

export const KickPlayerSchema = z.object({
    roomId: z.string(),
    playerId: z.string()
});

export const SwitchTeamSchema = z.object({
    roomId: z.string(),
    teamId: z.string()
});

export const UpdateTeamCountSchema = z.object({
    roomId: z.string(),
    count: z.number().min(APP_CONFIG.teams.minTeams).max(APP_CONFIG.teams.maxTeams)
});

export const UpdateTeamNameSchema = z.object({
    roomId: z.string(),
    teamId: z.string(),
    name: z.string().min(1).max(20).trim()
});

export const RoomActionSchema = z.object({
    roomId: z.string()
});

export const SubmitDrawingSchema = z.object({
    roomId: z.string(),
    drawingData: z.string()
        .max(1000000, "Drawing too large") // ~1MB limit (increased from review suggestion of 500KB to be safe)
        .refine((val) => val.startsWith('data:image/'), "Invalid image format")
});

export const SubmitGuessSchema = z.object({
    roomId: z.string(),
    guessText: z.string().min(1, "Guess cannot be empty").max(100, "Guess too long (max 100 chars)").trim()
});

export const UpdateSettingsSchema = z.object({
    roomId: z.string(),
    settings: z.object({
        difficulties: z.array(z.enum(['easy', 'medium', 'hard'])).min(1),
        drawTimeLimit: z.number().min(10000).max(300000).optional(),
        guessTimeLimit: z.number().min(5000).max(120000).optional()
    })
});
