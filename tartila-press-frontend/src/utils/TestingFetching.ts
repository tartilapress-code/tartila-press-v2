async function fetchData(): Promise<Response> {
    const response = await fetch(
        'https://zoo-animal-api.herokuapp.com/animals/rand/3'
    );

    if (!response.ok) {
        throw new Error(
            `Fetching data error! status: ${response.status} : ${response.statusText}`
        );
    }
    // const data = await response.json();
    return response;
}

function Main() {
    console.log(fetchData());
}

Main();
