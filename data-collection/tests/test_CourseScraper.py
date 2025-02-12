import unittest
import pandas as pd
from src.CourseScraper import CourseScraper

expected_base = 'https://www.scu.edu/bulletin/undergraduate/'

expected_tag_map = {
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

class TestCourseScraper(unittest.TestCase):

    def setUp(self):
        self.scraper = CourseScraper()

    def test_initialization(self):
        self.assertEqual(self.scraper.base, expected_base)
        self.assertEqual(self.scraper.tag_map, expected_tag_map)

    def test_get_tag_map(self):
        actual_tag_map = self.scraper.get_tag_map()
        self.assertEqual(actual_tag_map, expected_tag_map)

    def test_retrieve_course_df(self):
        actual_df = self.scraper.retrieve_course_df()
        self.assertIsInstance(actual_df, pd.DataFrame)

    

if __name__ == '__main__':
    unittest.main()
