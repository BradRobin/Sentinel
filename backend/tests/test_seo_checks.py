"""SEO head parser tests."""

from app.checks.seo import _parse_head


def test_parse_title_and_description():
    html = """
    <html><head>
    <title>ICT Authority</title>
    <meta name="description" content="Official ICTA website">
    </head></html>
    """
    title, desc = _parse_head(html)
    assert title == "ICT Authority"
    assert desc == "Official ICTA website"


def test_missing_meta_fails_parse():
    html = "<html><head><title>Only Title</title></head></html>"
    title, desc = _parse_head(html)
    assert title == "Only Title"
    assert desc is None
