
import { LanguageKey } from "./translations";

export interface Language {
  name: string;
  code: LanguageKey;
  flag: string;
}

export const languages: Language[] = [
  {
    name: "English",
    code: "en",
    flag: "🇬🇧"
  },
  {
    name: "Íslenska",
    code: "is",
    flag: "🇮🇸"
  }
];
