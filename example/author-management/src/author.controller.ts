import { Request, Response } from 'express';
import { createAuthor, getAllAuthors } from './author.service';

export async function createAuthorController(req: Request, res: Response): Promise<void> {
  const authorCreation = { name: req.body.name, twitter: req.body.twitter || null };

  const author = await createAuthor(authorCreation);

  res.json(author).status(201);
}

export async function getAllAuthorsController(_req: Request, res: Response): Promise<void> {
  const authors = await getAllAuthors();

  res.json(authors).status(200);
}
