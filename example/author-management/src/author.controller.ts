import { Request, Response } from 'express';
import { createAuthor } from './author.service';

export async function createAuthorController(req: Request, res: Response): Promise<void> {
  const authorCreation = { name: req.body.name, twitter: req.body.twitter || null };

  const author = await createAuthor(authorCreation);

  res.json(author).status(201);
}
