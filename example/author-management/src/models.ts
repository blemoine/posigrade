export type Author = {
  id: number;
  name: string;
  twitter: string | null;
};
export type Book = {
  id: number;
  title: string;
  author: Author;
  published: Date;
};

export type AuthorCreationModel = {
  name: string;
  twitter: string | null;
};

export type BookCreationModel = {
  title: string;
  author: { id: number };
  published: Date;
};
