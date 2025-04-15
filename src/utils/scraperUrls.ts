
export const getDefaultUrl = (title: string): string => {
  switch (title.toLowerCase()) {
    case "bills":
      return "https://www.althingi.is/thingstorf/thingmalalistar-eftir-thingum/";
    case "votes":
      return "https://www.althingi.is/thingstorf/atkvaedagreidslur/";
    case "speeches":
      return "https://www.althingi.is/altext/raedur/";
    case "mps":
      return "https://www.althingi.is/thingmenn/althingismenn/";
    case "committees":
      return "https://www.althingi.is/thingnefndir/fastanefndir/";
    case "issues":
      return "https://www.althingi.is/thingstorf/thingmalalistar-eftir-thingum/";
    default:
      return `https://www.althingi.is/`;
  }
};
