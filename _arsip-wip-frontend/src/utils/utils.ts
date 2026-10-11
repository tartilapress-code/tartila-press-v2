import books from '../data/dummy-book.json';

// const regex: RegExp = /[a-zA-Z]+/g;

const searchWord: string = 'akuntansi';
const dynamicRegex: RegExp = new RegExp(`\\b${searchWord}\\b`, 'i');
const selectedCategory = 'Software Engineering'

const regex: RegExp = /[a-zA-Z]+/g;

// const bookTitle = books[0].judul_buku;

books
    .filter((book) =>
        dynamicRegex.test(book.judul_buku) &&
        book.kategori === selectedCategory)
)
    .forEach((book) => {

        console.log(book.judul_buku);
    });
