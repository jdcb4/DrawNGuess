import { ZodError } from 'zod';

export const formatZodError = (error: ZodError): string => {
    // Cast to any to avoid potential version mismatch issues with Zod types in this env
    const err = error as any;
    if (err.errors && err.errors.length > 0) {
        return err.errors[0].message;
    }
    return 'Invalid data';
};
