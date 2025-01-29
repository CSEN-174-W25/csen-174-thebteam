import requests
from bs4 import BeautifulSoup
import pandas as pd

class CourseScraper:
    def __init__(self):
        self.base = 'https://www.scu.edu/bulletin/undergraduate/'

        # Send a GET request to fetch the page content
        response = requests.get(self.base)

        # Check if the request was successful
        if response.status_code == 200:
            page_content = response.text
        else:
            print(f"Failed to retrieve content from {self.base}")
            exit()

        # Create a BeautifulSoup object to parse the HTML content
        self.soup = BeautifulSoup(page_content, 'html.parser')


    def _get_url_map(self):
        sidebar = self.soup.find_all('ul', class_='bltFolder')

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

    def _get_course_info(self, soupObj: BeautifulSoup, college, department, show=False):
        content = soupObj.find('body', class_='doc-content')

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
                print(f"Failed to retrieve content from {self.base}")
                exit()

            # Create a BeautifulSoup object to parse the HTML content
            soupObj = BeautifulSoup(page_content, 'html.parser')
            col, dep, num, cou, des = self._get_course_info(soupObj, college, department)

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