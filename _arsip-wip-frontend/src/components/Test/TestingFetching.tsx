export default async function Main() {
    const url: string = 'https://zoo-animal-api.herokuapp.com/animals/rand/3';

    console.log();
}

async function fetchData(url: string): Promise<JSON> {
    const randomAnimal = (await fetch(url)).json();
    return randomAnimal;
}
