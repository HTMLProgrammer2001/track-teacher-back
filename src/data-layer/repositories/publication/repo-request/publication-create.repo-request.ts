export class PublicationCreateRepoRequest {
  title: string;
  date: Date;
  publisher?: string;
  url?: string;
  anotherAuthors?: string;
  description?: string;
  userIds: Array<number>;
}
