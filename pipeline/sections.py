import re

from bs4 import BeautifulSoup

# Smaller cities often have no "Culture" section, so if an article doesn't have one
# we fall back to sections about these topics instead
CULTURE_TOPICS = re.compile(r'\b(arts|museum|landmark|sights|attractions|interest|architecture|'
                            r'cuisine|festival|heritage|literature|music|theatre|theater|tourism)')


def is_history(heading):
    return heading.lower() == 'history'


def is_culture(heading):
    # culture headings vary: "Culture", "Arts and culture", "Cultural heritage", ...
    heading = heading.lower()
    return 'cultur' in heading and 'popular culture' not in heading and 'pop culture' not in heading


def is_culture_topic(heading):
    return CULTURE_TOPICS.search(heading.lower()) is not None


def extract_sections(html, url):
    """Keeps only the overview, history, and culture sections of an article's HTML.

    Wikipedia's HTML wraps each section in a <section> tag, with subsections nested
    inside their parent, so grabbing the whole tag keeps the subsections too.
    """
    soup = BeautifulSoup(html, 'html.parser')
    overview = None
    history = None
    culture = []
    culture_topics = []

    for section in soup.body.find_all('section', recursive=False):
        # section 0 is the intro before the first heading
        if section.get('data-mw-section-id') == '0':
            overview = {'heading': None, 'url': url, 'html': str(section)}
            continue

        h2 = section.find('h2', recursive=False)
        if h2 is None:
            continue

        heading = h2.get_text(strip=True)
        info = {'heading': heading, 'url': f'{url}#{h2["id"]}', 'html': str(section)}
        if is_history(heading) and history is None:
            history = info
        elif is_culture(heading):
            culture.append(info)
        elif is_culture_topic(heading):
            culture_topics.append(info)

    return {'overview': overview, 'history': history, 'culture': culture or culture_topics}
