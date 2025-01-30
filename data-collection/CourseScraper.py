import requests
from bs4 import BeautifulSoup
import pandas as pd

class CourseScraper:
    def __init__(self):
        self.base = 'https://www.scu.edu/bulletin/undergraduate/'

        self.tag_map = {
                
                # CAS
                'Anthropology': 'ANTH',
                'Art  and  Art  History': 'ARTH',
                'Biology': 'BIOL',
                'Chemistry and Biochemistry': 'CHEM',
                'Child Studies': 'CHST',
                'Classics': 'CLAS',
                'Communication': 'COMM',
                'Economics': 'ECON',
                'English': 'ENGL',
                'Environmental  Studies  and  Sciences': 'ENVS',
                'Ethnic Studies': 'ETHN',
                'History': 'HIST',
                'Mathematics and Computer Science': 'MATH/CSCI',
                'Modern Languages and Literatures': '????',
                'Music': 'MUSC',
                'Neuroscience': 'NEUR',
                'Philosophy': 'PHIL',
                'Physics': 'PHYS',
                'Political Science': 'POLI',
                'Psychology': 'PSYC',
                'Public  Health  Department': 'PHSC',
                'Religious Studies': 'TESP',
                'Sociology': 'SOCI',
                'Theatre  and  Dance': 'THTR/DANC',
                'Womens and Gender Studies': 'WGST',
                'Gender and Sexuality Studies': 'WGST',
                'Arabic Islamic and Middle Eastern Studies': '????',
                'Asian Studies': 'ASIA',
                'Catholic Studies': 'ASCI',
                'Latin American Studies': '????',
                'Premodern  Studies': '????',

                # LSB
                'Management': 'MGMT',
                'Marketing': 'MKTG',
                'Information  Systems &  Analytics': 'OMIS',
                'Accounting': 'ACTG',
                'Economics': 'ECON',
                'Finance': 'FNCE',

                # SOE
                'Applied Mathematics': 'AMTH',
                'Bioengineering' : 'BIOE',
                'Civil, Environmental, and Sustainable  Engineering' : 'CENG',
                'Computer  Science  and  Engineering' : 'CSEN',
                'Electrical and Computer Engineering' : 'ECEN',
                'General Engineering' : 'ENGR',
                'Mechanical  Engineering': 'MECH'
            }
        
    def _get_url_map(self):
        # Send a GET request to fetch the page content
        response = requests.get(self.base)

        # Check if the request was successful
        if response.status_code == 200:
            page_content = response.text
        else:
            print(f"Failed to retrieve content from {self.base}")
            exit()

        # Create a BeautifulSoup object to parse the HTML content
        soup = BeautifulSoup(page_content, 'html.parser')

        sidebar = soup.find_all('ul', class_='bltFolder')

        college_tag = {
            'CAS': sidebar[3],
            'LSB': sidebar[4],
            'SOE': sidebar[5]
        }

        url_map = {}
        skip = set([
            ' Medical  and  Health  Humanities ',
            ' Undergraduate Degrees',
            ' Centers Institutes and Special Programs'
        ])

        for college, tag in college_tag.items(): 
            for anchor in tag.find_all('a'):
                department = anchor.get_text()
                if department in skip: 
                    continue

                url = self.base + anchor.get('href')[2:]

                url_map[(college, department)] = url

        return url_map

    def _get_course_info(self, soup: BeautifulSoup, college, department, show=False):
        content = soup.find('body', class_='doc-content')

        col = []
        dep = []
        num = []
        cou = []
        des = []

        next = False
        for elm in content.children:
            if next:
                des.append(elm.get_text())
                
                next = False

                if show:
                    print(elm.get_text())

            if elm.name == 'h3':
                arr = elm.get_text().split('.')
                number = arr[0]
                course = ''.join(arr[1:])

                col.append(college)
                dep.append(department)
                num.append(number)
                cou.append(course)

                next = True

                if show:
                    print(elm.get_text())

        if next:
            des.append('-')
        
        return col, dep, num, cou, des

    def retrieve_course_df(self) -> pd.DataFrame:
        url_map = self._get_url_map()

        colleges = []
        departments = []
        numbers = []
        courses = []
        descriptions = []

        for (college, department), url in url_map.items():
            # Send a GET request to fetch the page content
            response = requests.get(url)

            # Check if the request was successful
            if response.status_code == 200:
                page_content = response.text
            else:
                print(f"Failed to retrieve content from {url}")
                exit()

            # Create a BeautifulSoup object to parse the HTML content
            soup = BeautifulSoup(page_content, 'html.parser')
            col, dep, num, cou, des = self._get_course_info(soup, college, department)

            colleges += col
            departments += dep
            numbers += num 
            courses += cou
            descriptions += des

        return pd.DataFrame({
            'college': colleges,
            'department': departments,
            'number': numbers,
            'course': courses,
            'description': descriptions
        })
    
    def get_tag_map(self):
        return self.tag_map

    def add_prereq_col(course_df: pd.DataFrame):
        pass 

def main():
    scraper = CourseScraper() 
    course_df = scraper.retrieve_course_df()
    course_df.to_csv('./data/courses.csv', index=False)
    print('Course successfully retrieved and saved in /data/courses.csv')

if __name__ == "__main__":
    main()
 