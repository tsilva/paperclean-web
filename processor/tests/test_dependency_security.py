from importlib.metadata import version

from packaging.version import Version


def test_pytest_tmpdir_fix_is_installed_and_tmp_path_remains_usable(tmp_path) -> None:
    assert Version(version("pytest")) >= Version("9.0.3")

    control = tmp_path / "legitimate-control.txt"
    control.write_text("isolated", encoding="utf-8")
    assert control.read_text(encoding="utf-8") == "isolated"
    assert control.parent == tmp_path
