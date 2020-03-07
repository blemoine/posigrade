import express from 'express';
import { createAuthorController } from './author.controller';
import { getAllAuthors } from './author.service';

export const router = express.Router();

router.get('/authors', getAllAuthors);

router.post('/authors', createAuthorController);
/*
const noop = () => {};
router.get('/authors/:id', noop);
router.put('/authors/:id', noop);
router.delete('/authors/:id', noop);

router.get('/books', noop);
router.post('/books', noop);

router.get('/books/:id', noop);
router.put('/books/:id', noop);
router.delete('/books/:id', noop);
*/
